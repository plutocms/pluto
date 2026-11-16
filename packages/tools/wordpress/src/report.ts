import type { MediaFailure } from './media'
import type { BlocksTheme, FontUse, PageReport } from './types'
import { themeSnippet } from './theme'

export interface PageResult {
  wordpressId?: number
  title: string
  path: string
  status: 'published' | 'draft'
  action: 'written' | 'skipped' | 'conflict' | 'planned'
  reason?: string
  blocks: number
  report: PageReport
}

export interface OtherItem {
  kind: string
  title: string
  detail: string
}

export interface MediaSummary {
  enabled: boolean
  planned: number
  downloaded: number
  reused: number
  failures: MediaFailure[]
}

export interface ReportInput {
  source: string
  generatedAt: string
  dryRun: boolean
  pages: PageResult[]
  others: OtherItem[]
  media: MediaSummary
  theme?: BlocksTheme
  fonts: FontUse[]
}

function count(values: Record<string, number>): string {
  return Object.entries(values)
    .map(([name, total]) => `${name} x${total}`)
    .join(', ')
}

function pageLines(page: PageResult): string[] {
  const report = page.report
  const lines: string[] = []

  if (report.placeholders.length > 0) {
    lines.push(`- Placeholders: ${report.placeholders.length}`)

    for (const entry of report.placeholders) {
      lines.push(`  - ${entry}`)
    }
  }

  if (Object.keys(report.unknownWidgets).length > 0) {
    lines.push(`- Unknown widgets: ${count(report.unknownWidgets)}`)
  }

  if (report.shortcodes.length > 0) {
    lines.push(
      `- Shortcodes: ${report.shortcodes.map((code) => `\`${code}\``).join(', ')}`
    )
  }

  if (report.rawHtml.length > 0) {
    lines.push(`- Raw HTML widgets: ${report.rawHtml.length}`)

    for (const entry of report.rawHtml) {
      lines.push(`  - \`${entry.replace(/`/g, "'")}\``)
    }
  }

  if (report.roundings.length > 0) {
    lines.push('- Rounded values:')

    for (const entry of report.roundings) {
      lines.push(`  - ${entry}`)
    }
  }

  if (report.droppedResponsive > 0) {
    lines.push(
      `- Dropped responsive values (tablet, mobile and other breakpoints): ${report.droppedResponsive}`
    )
  }

  if (Object.keys(report.ignoredStyles).length > 0) {
    lines.push(`- Styles with no block prop: ${count(report.ignoredStyles)}`)
  }

  if (report.unmappedIcons.length > 0) {
    lines.push(
      `- Icons with no Lucide match (default icon used): ${report.unmappedIcons.join(', ')}`
    )
  }

  if (report.addonPrefixes.length > 0) {
    lines.push(`- Add-on prefixes found: ${report.addonPrefixes.join(', ')}`)
  }

  if (report.missingAlt > 0) {
    lines.push(`- Images with no alt text: ${report.missingAlt}`)
  }

  for (const entry of report.notes) {
    lines.push(`- ${entry}`)
  }

  return lines.length > 0 ? lines : ['- Nothing to report.']
}

function groupOthers(items: OtherItem[]) {
  const groups = new Map<
    string,
    { kind: string; detail: string; titles: string[] }
  >()

  for (const item of items) {
    const key = `${item.kind}|${item.detail}`
    const group = groups.get(key) ?? {
      kind: item.kind,
      detail: item.detail,
      titles: [],
    }

    group.titles.push(item.title)
    groups.set(key, group)
  }

  return [...groups.values()]
}

function fontLines(fonts: FontUse[]): string[] {
  if (fonts.length === 0) {
    return ['No fonts found.']
  }

  const families = fonts.map((font) => {
    const weights =
      font.weights.length > 0 ? `, weights: [${font.weights.join(', ')}]` : ''

    return `      { name: '${font.family}', provider: 'google'${weights} },`
  })

  return [
    'Add the Google fonts below with `@nuxt/fonts` (`bunx nuxi module add fonts`), then list them in `nuxt.config.ts`:',
    '',
    '```ts',
    'export default defineNuxtConfig({',
    "  modules: ['@nuxt/fonts'],",
    '  fonts: {',
    '    families: [',
    ...families,
    '    ],',
    '  },',
    '})',
    '```',
  ]
}

/** The text of `pluto-import-report.md`. */
export function buildReport(input: ReportInput): string {
  const written = input.pages.filter((page) => page.action === 'written')
  const planned = input.pages.filter((page) => page.action === 'planned')
  const skipped = input.pages.filter((page) => page.action === 'skipped')
  const conflicts = input.pages.filter((page) => page.action === 'conflict')
  const lines = [
    '# Pluto import report',
    '',
    `Source: \`${input.source}\``,
    `Date: ${input.generatedAt}`,
    input.dryRun ? 'Mode: dry run (nothing was written).' : 'Mode: import.',
    '',
    '## Summary',
    '',
    input.dryRun
      ? `- Pages to import: ${planned.length}`
      : `- Pages imported: ${written.length}`,
    `- Pages skipped (already imported): ${skipped.length}`,
    `- Pages not written (another file is there, use --force): ${conflicts.length}`,
  ]

  if (input.media.enabled) {
    lines.push(
      input.dryRun
        ? `- Images to download: ${input.media.planned}`
        : `- Images: ${input.media.downloaded} downloaded, ${input.media.reused} reused, ${input.media.failures.length} failed`
    )
  } else {
    lines.push('- Images: kept as remote URLs (--no-media).')
  }

  lines.push('', '## Pages', '')

  for (const page of input.pages) {
    const id =
      page.wordpressId === undefined ? '' : ` (WordPress ${page.wordpressId})`

    lines.push(`### ${page.path}`, '')
    lines.push(
      `"${page.title}"${id}, ${page.status}, ${page.action}${page.reason ? `: ${page.reason}` : ''}, ${page.blocks} top-level blocks.`,
      ''
    )
    lines.push(...pageLines(page), '')
  }

  if (input.pages.length === 0) {
    lines.push('No pages were found.', '')
  }

  lines.push('## Not imported', '')

  if (input.others.length === 0) {
    lines.push('Nothing.', '')
  } else {
    for (const group of groupOthers(input.others)) {
      const titles = group.titles.map((title) => `"${title}"`).join(', ')

      lines.push(`- ${group.kind} (${group.titles.length}): ${group.detail}`)
      lines.push(`  - ${titles}`)
    }

    lines.push('')
  }

  if (input.media.failures.length > 0) {
    lines.push('## Images that were not downloaded', '')

    for (const failure of input.media.failures) {
      lines.push(`- ${failure.url}: ${failure.reason}`)
    }

    lines.push('')
  }

  lines.push('## Theme', '')

  if (input.theme) {
    lines.push(
      'Written to `pluto-import/theme.json`. Paste it in `app.config.ts`:',
      '',
      '```ts',
      themeSnippet(input.theme),
      '```',
      ''
    )
  } else {
    lines.push('The file has no Elementor kit, so there is no theme.', '')
  }

  lines.push('## Fonts', '', ...fontLines(input.fonts), '')

  return lines.join('\n')
}
