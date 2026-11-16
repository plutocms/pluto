import type { ImportResult } from './import'
import { resolve } from 'node:path'
import process from 'node:process'
import { parseArgs } from 'node:util'
import { runImport } from './import'

const HELP = `pluto-wordpress: import Elementor pages, menus and the footer from WordPress into a Pluto project

Usage:
  pluto-wordpress import <file.xml|page.json> [options]

Options:
  --out <dir>   The Pluto project folder (default: the current folder)
  --dry-run     Write nothing. Print the plan and the report
  --no-media    Keep the remote image URLs. Download nothing
  --force       Write a file again, even when it is already there
  -h, --help    Show this help
`

function summary(result: ImportResult, dryRun: boolean): string[] {
  const lines: string[] = []
  const count = (action: string) =>
    result.pages.filter((page) => page.action === action).length

  lines.push(
    dryRun
      ? `Plan: ${count('planned')} pages to import, ${count('skipped')} to skip, ${count('conflict')} with another file in the way.`
      : `Imported ${count('written')} pages, skipped ${count('skipped')}, ${count('conflict')} not written.`
  )

  for (const page of result.pages) {
    lines.push(
      `  ${page.action.padEnd(8)} ${page.path} (${page.status})${page.reason ? `: ${page.reason}` : ''}`
    )
  }

  for (const menu of result.menus) {
    lines.push(
      `  ${menu.action.padEnd(8)} menu ${menu.handle} (${menu.items} items)${menu.reason ? `: ${menu.reason}` : ''}`
    )
  }

  if (result.footer) {
    lines.push(
      `  ${result.footer.action.padEnd(8)} footer area${result.footer.reason ? `: ${result.footer.reason}` : ''}`
    )
  }

  if (result.media.enabled) {
    lines.push(
      dryRun
        ? `Images to download: ${result.media.planned}`
        : `Images: ${result.media.downloaded} downloaded, ${result.media.reused} reused, ${result.media.failures.length} failed`
    )
  }

  if (result.others.length > 0) {
    lines.push(`Not imported: ${result.others.length} items (see the report).`)
  }

  return lines
}

/** Runs the CLI with the arguments after the program name. */
export async function main(argv: string[]): Promise<void> {
  const { positionals, values } = parseArgs({
    args: argv,
    allowPositionals: true,
    options: {
      out: { type: 'string' },
      'dry-run': { type: 'boolean' },
      media: { type: 'boolean', default: true },
      'no-media': { type: 'boolean' },
      force: { type: 'boolean' },
      help: { type: 'boolean', short: 'h' },
    },
  })
  const [command, input] = positionals

  if (values.help || !command) {
    process.stdout.write(HELP)

    return
  }

  if (command !== 'import' || !input) {
    process.stderr.write(`${HELP}\nUse: pluto-wordpress import <file>\n`)
    process.exitCode = 1

    return
  }

  const dryRun = values['dry-run'] === true

  try {
    const result = await runImport({
      input: resolve(input),
      out: resolve(values.out ?? '.'),
      dryRun,
      media: values['no-media'] ? false : values.media,
      force: values.force,
    })

    process.stdout.write(`${summary(result, dryRun).join('\n')}\n`)

    if (result.themeSnippet) {
      process.stdout.write(
        `\nAdd this to app.config.ts (also in pluto-import/theme.json):\n\n${result.themeSnippet}\n`
      )
    }

    process.stdout.write(
      dryRun
        ? `\n${result.report}\n`
        : `\nReport: ${resolve(values.out ?? '.', 'pluto-import-report.md')}\n`
    )
  } catch (error) {
    process.stderr.write(
      `Error: ${error instanceof Error ? error.message : String(error)}\n`
    )
    process.exitCode = 1
  }
}
