// Moves the @plutocms/* dependencies of this repo to their newest versions on
// npm. The plutocms-update workflow runs it, and the same file is in every
// Pluto repo.
//
// - A wide range (`>=0.34.0 <1.0.0`, used by the layers) keeps its text. Only
//   the lockfile moves, so the repo tests against the new version.
// - A caret range or an exact version (the apps) moves to the newest version.
// - In a Bun workspace (a monorepo), it reads the package.json of the root and
//   of each workspace package.
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

/**
 * The @plutocms packages that the lockfile resolves from npm (a version, not a
 * workspace link). It also finds the packages that only a layer brings, such
 * as `@plutocms/supabase` under `@plutocms/supabase-shop`.
 */
export function lockPlutoNames(lock) {
  const pattern = /"(@plutocms\/[a-z\d-]+)@\d[^"]*"/g
  return [...new Set([...lock.matchAll(pattern)].map((m) => m[1]))].sort()
}

async function latestVersion(name) {
  const response = await fetch(`https://registry.npmjs.org/${name}/latest`)
  if (!response.ok) {
    throw new Error(`npm answered ${response.status} for ${name}`)
  }
  return (await response.json()).version
}

/**
 * The folders with a package.json: the root, then each workspace package
 * (`workspaces` entries `dir` or `dir/*`).
 */
export function packageDirs(root = '.') {
  const pkg = JSON.parse(fs.readFileSync(`${root}/package.json`, 'utf8'))
  const patterns = Array.isArray(pkg.workspaces)
    ? pkg.workspaces
    : (pkg.workspaces?.packages ?? [])
  const dirs = ['.']
  for (const pattern of patterns) {
    if (pattern.endsWith('/*')) {
      const base = pattern.slice(0, -2)
      const names = fs.existsSync(`${root}/${base}`)
        ? fs.readdirSync(`${root}/${base}`).sort()
        : []
      dirs.push(...names.map((name) => `${base}/${name}`))
    } else {
      dirs.push(pattern)
    }
  }
  return dirs.filter((dir) => fs.existsSync(`${root}/${dir}/package.json`))
}

function readLock() {
  return fs.existsSync('bun.lock') ? fs.readFileSync('bun.lock', 'utf8') : ''
}

async function main() {
  const packages = packageDirs().map((dir) => {
    const file = `${dir}/package.json`
    const pkg = JSON.parse(fs.readFileSync(file, 'utf8'))
    const names = [
      ...new Set(
        SECTIONS.flatMap((section) => Object.keys(pkg[section] ?? {})).filter(
          (name) => name.startsWith('@plutocms/')
        )
      ),
    ].sort()
    return { dir, file, pkg, names, changed: false }
  })
  const names = [...new Set(packages.flatMap((entry) => entry.names))].sort()

  const before = readLock()
  const bumped = []
  const wide = []
  const latest = {}

  for (const name of names) {
    latest[name] = await latestVersion(name)
  }
  for (const entry of packages) {
    for (const name of entry.names) {
      for (const section of SECTIONS) {
        const spec = entry.pkg[section]?.[name]
        if (!spec) {
          continue
        }
        if (isWideRange(spec)) {
          wide.push(name)
          continue
        }
        const next = nextSpec(spec, latest[name])
        if (next) {
          entry.pkg[section][name] = next
          entry.changed = true
          bumped.push(`${name} ${spec} → ${next}`)
        }
      }
    }
  }

  if (dryRun) {
    console.log(
      JSON.stringify(
        { packages: packages.map((entry) => entry.dir), names, bumped, wide },
        null,
        2
      )
    )
    return
  }

  for (const entry of packages.filter((item) => item.changed)) {
    fs.writeFileSync(
      entry.file,
      `${JSON.stringify(entry.pkg, null, 2)}
`
    )
  }
  // `bun install` applies the new specs. `bun update` of every @plutocms
  // package then moves the lockfile inside the wide ranges, and drops an older
  // copy nested under another @plutocms package (`bun install` keeps it). In a
  // workspace package it runs in the folder of the package, so the root
  // package.json does not get the dependency. Install scripts are not needed
  // here.
  execSync('bun install --ignore-scripts', { stdio: 'inherit' })
  const wideNames = [...new Set(wide)]
  let transitive = []
  if (fs.existsSync('bun.lock')) {
    for (const entry of packages.filter((item) => item.names.length)) {
      execSync(`bun update --ignore-scripts ${entry.names.join(' ')}`, {
        cwd: entry.dir,
        stdio: 'inherit',
      })
    }
    // The @plutocms packages that only the lockfile has: a layer brings them
    // (an app that lists `@plutocms/supabase-shop` gets `@plutocms/supabase`
    // through it). `bun update` at the root moves them in the lockfile and does
    // not add them to package.json. Read the lockfile after the updates above:
    // a new version of a layer can drop a package, and `bun update` of a name
    // that is not in the lockfile fails.
    transitive = lockPlutoNames(readLock()).filter(
      (name) => !names.includes(name)
    )
    if (transitive.length) {
      execSync(`bun update --ignore-scripts ${transitive.join(' ')}`, {
        stdio: 'inherit',
      })
    }
  }

  const after = readLock()
  const moved = []
  if (before) {
    for (const name of [...wideNames, ...transitive]) {
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
