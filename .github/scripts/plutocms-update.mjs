// Moves the @plutocms/* dependencies of this repo to their newest versions on
// npm. The plutocms-update workflow runs it, and the same file is in every
// Pluto repo.
//
// - A wide range (`>=0.34.0 <1.0.0`, used by the layers) keeps its text. Only
//   the lockfile moves, so the repo tests against the new version.
// - A caret range or an exact version (the apps) moves to the newest version.
//
// It writes `changed` and `summary` to $GITHUB_OUTPUT when that is set.
// Usage: node .github/scripts/plutocms-update.mjs [--dry-run]

import { execSync } from 'node:child_process'
import fs from 'node:fs'

const SECTIONS = ['dependencies', 'devDependencies', 'optionalDependencies']
const dryRun = process.argv.includes('--dry-run')

/** -1, 0 or 1. Plain `x.y.z` versions only (Pluto publishes no prereleases). */
export function compareVersions(a, b) {
  const pa = a.split('.').map(Number)
  const pb = b.split('.').map(Number)
  for (let i = 0; i < 3; i++) {
    if (pa[i] !== pb[i]) {
      return pa[i] > pb[i] ? 1 : -1
    }
  }
  return 0
}

/**
 * The new spec for a caret or exact spec when `latest` is newer, or null.
 * A wide range, a tag, a path or a git URL gives null.
 */
export function nextSpec(spec, latest) {
  const match = /^(\^|~)?(\d+\.\d+\.\d+)$/.exec(spec)
  if (!match || compareVersions(latest, match[2]) <= 0) {
    return null
  }
  return `${match[1] ?? ''}${latest}`
}

/** True for a range that the lockfile moves inside (`>=x`, `>=x <y`). */
export function isWideRange(spec) {
  return /^>=\s*\d/.test(spec)
}

/** The versions of `name` that the lockfile resolves. */
export function lockVersions(lock, name) {
  const pattern = new RegExp(`"${name.replace('/', '\\/')}@([0-9][^"]*)"`, 'g')
  return [...new Set([...lock.matchAll(pattern)].map((m) => m[1]))]
}

async function latestVersion(name) {
  const response = await fetch(`https://registry.npmjs.org/${name}/latest`)
  if (!response.ok) {
    throw new Error(`npm answered ${response.status} for ${name}`)
  }
  return (await response.json()).version
}

function readLock() {
  return fs.existsSync('bun.lock') ? fs.readFileSync('bun.lock', 'utf8') : ''
}

async function main() {
  const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'))
  const names = [
    ...new Set(
      SECTIONS.flatMap((section) => Object.keys(pkg[section] ?? {})).filter(
        (name) => name.startsWith('@plutocms/')
      )
    ),
  ].sort()

  const before = readLock()
  const bumped = []
  const wide = []

  for (const name of names) {
    const latest = await latestVersion(name)
    for (const section of SECTIONS) {
      const spec = pkg[section]?.[name]
      if (!spec) {
        continue
      }
      if (isWideRange(spec)) {
        wide.push(name)
        continue
      }
      const next = nextSpec(spec, latest)
      if (next) {
        pkg[section][name] = next
        bumped.push(`${name} ${spec} → ${next}`)
      }
    }
  }

  if (dryRun) {
    console.log(JSON.stringify({ names, bumped, wide }, null, 2))
    return
  }

  if (bumped.length) {
    fs.writeFileSync('package.json', `${JSON.stringify(pkg, null, 2)}\n`)
  }
  // `bun install` applies the new specs. `bun update <names>` moves the
  // lockfile inside the wide ranges. Install scripts are not needed here.
  execSync('bun install --ignore-scripts', { stdio: 'inherit' })
  const wideNames = [...new Set(wide)]
  if (wideNames.length && fs.existsSync('bun.lock')) {
    execSync(`bun update --ignore-scripts ${wideNames.join(' ')}`, {
      stdio: 'inherit',
    })
  }

  const after = readLock()
  const moved = []
  if (before) {
    for (const name of wideNames) {
      const was = lockVersions(before, name).join(', ')
      const now = lockVersions(after, name).join(', ')
      if (was !== now) {
        moved.push(`${name} ${was} → ${now} (lockfile)`)
      }
    }
  }

  const changes = [...bumped, ...moved]
  const summary = changes.length
    ? changes.join('; ')
    : 'all @plutocms packages are up to date'
  console.log(summary)
  if (process.env.GITHUB_OUTPUT) {
    fs.appendFileSync(
      process.env.GITHUB_OUTPUT,
      `changed=${changes.length > 0}\nsummary=${summary}\n`
    )
  }
}

// Run only as a script, not when a test imports the functions above.
if (process.argv[1]?.endsWith('plutocms-update.mjs')) {
  await main()
}
