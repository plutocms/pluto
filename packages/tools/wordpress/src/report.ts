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

export type WriteAction = 'written' | 'skipped' | 'conflict' | 'planned'

export interface MenuResult {
  handle: string
  title: string
  wordpressId?: number
  action: WriteAction
  reason?: string
  items: number
  main: boolean
  unmapped: string[]
}

export interface MenusReport {
  menus: MenuResult[]
  empty: string[]
  main?: {
    handle: string
    name: string
    reason: string
  }
}

export interface AreaResult {
  handle: string
  title: string
  wordpressId?: number
  source: string
  action: WriteAction
  reason?: string
  blocks: number
  report: PageReport
}

export interface HeaderSummary {
  title: string
  source: string
  menu?: string
  mappedTo?: string
  widgets: Record<string, number>
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
  menus: MenusReport
  footer?: AreaResult
  headers: HeaderSummary[]
}

function count(values: Record<string, number>): string {
  return Object.entries(values)
    .map(([name, total]) => `${name} x${total}`)
    .join(', ')
}

function pageLines(page: { report: PageReport }): string[] {
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

function summaryLines(input: ReportInput): string[] {
  const menus = input.menus.menus.filter(
    (menu) => menu.action === 'written' || menu.action === 'planned'
  )
  const footer = input.footer
    ? input.footer.action === 'planned'
      ? 'to import'
      : input.footer.action
    : 'none found'

  return [
    input.dryRun
      ? `- Menus to import: ${menus.length}`
      : `- Menus imported: ${menus.length}`,
    `- Footer area: ${footer}`,
  ]
}

function menuSection(menus: MenusReport): string[] {
  const lines = ['## Menus', '']

  if (menus.menus.length === 0) {
    lines.push('No menus were found.', '')

    return lines
  }

  const total = menus.menus.reduce((sum, menu) => sum + menu.items, 0)

  lines.push(`${menus.menus.length} menus, ${total} items.`, '')

  if (menus.main) {
    lines.push(
      `The menu "${menus.main.name}" became \`main\`, because ${menus.main.reason}. The export does not say which menu the theme shows in its header, so check this choice.`,
      ''
    )
  }

  if (menus.empty.length > 0) {
    lines.push(
      `Menus with no item (not imported): ${menus.empty.map((name) => `"${name}"`).join(', ')}.`,
      ''
    )
  }

  for (const menu of menus.menus) {
    const id =
      menu.wordpressId === undefined ? '' : ` (WordPress ${menu.wordpressId})`

    lines.push(`### ${menu.handle}`, '')
    lines.push(
      `"${menu.title}"${id}, ${menu.action}${menu.reason ? `: ${menu.reason}` : ''}, ${menu.items} items.`,
      ''
    )

    if (menu.unmapped.length > 0) {
      lines.push(`- Items with no Pluto equivalent: ${menu.unmapped.length}`)

      for (const entry of menu.unmapped) {
        lines.push(`  - ${entry}`)
      }

      lines.push('')
    }
  }

  return lines
}

function footerSection(footer: AreaResult | undefined): string[] {
  const lines = ['## Footer area', '']

  if (!footer) {
    lines.push('No footer was found in the export.', '')

    return lines
  }

  const id =
    footer.wordpressId === undefined
      ? ''
      : ` (WordPress ${footer.wordpressId})`

  lines.push(
    `"${footer.title}"${id} from ${footer.source}, ${footer.action}${footer.reason ? `: ${footer.reason}` : ''}, ${footer.blocks} top-level blocks. File: \`content/areas/${footer.handle}.md\`.`,
    ''
  )
  lines.push(...pageLines(footer), '')

  return lines
}

function headerSection(
  headers: HeaderSummary[],
  main: MenusReport["main"]
): string[] {
  if (headers.length === 0) {
    return []
  }

  const lines = ['## Header', '']

  for (const header of headers) {
    lines.push(
      `"${header.title}" (${header.source}) is not imported. A header layout is the job of the template.`
    )

    if (header.menu) {
      lines.push(
        header.mappedTo
          ? `- Its navigation menu "${header.menu}" is the \`${header.mappedTo}\` menu.`
          : `- Its navigation menu "${header.menu}" was not imported.`
      )

      if (main && header.mappedTo && header.mappedTo !== main.handle) {
        lines.push(
          `- The \`main\` menu is "${main.name}", not this one. To use the header menu as \`main\`, swap the files \`content/menus/main.md\` and \`content/menus/${header.mappedTo}.md\`.`
        )
      }
    }

    lines.push(
      Object.keys(header.widgets).length > 0
        ? `- Its widgets: ${count(header.widgets)}`
        : '- It has no widget.'
    )
  }

  lines.push('')

  return lines
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
    ...summaryLines(input),
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

  lines.push(
    ...menuSection(input.menus),
    ...footerSection(input.footer),
    ...headerSection(input.headers, input.menus.main)
  )

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
