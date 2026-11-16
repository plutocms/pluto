import type { MediaSummary, OtherItem, PageResult } from './report'
import type {
  Attachment,
  BlocksTheme,
  ConvertContext,
  ElementorElement,
  FontUse,
  Kit,
  WxrPost,
} from './types'
import { readFile } from 'node:fs/promises'
import { basename, join } from 'node:path'
import { convertElements } from './convert'
import {
  parseMarkdownFile,
  readIfExists,
  serializeMarkdownFile,
  writeFileDeep,
} from './files'
import { serializeBlocks } from './mdc'
import { importMedia } from './media'
import {
  descriptionOf,
  isPublished,
  pagePaths,
  publishedAt,
  rewriteMedia,
  slugify,
} from './pages'
import { buildReport } from './report'
import { cleanTheme, emptyKit, isKit, kitFromPost, themeSnippet } from './theme'
import { emptyReport } from './types'
import { SYSTEM_FONTS } from './values'
import { readWxr } from './wxr'

export interface ImportOptions {
  input: string
  out: string
  dryRun?: boolean
  media?: boolean
  force?: boolean
  fetch?: typeof fetch
  now?: () => Date
}

export interface ImportResult {
  pages: PageResult[]
  others: OtherItem[]
  media: MediaSummary
  theme?: BlocksTheme
  themeSnippet?: string
  fonts: FontUse[]
  report: string
  written: string[]
}

interface SourcePage {
  id?: number
  title: string
  path: string
  status: string
  link: string
  description?: string
  publishedAt?: string
  elements: ElementorElement[]
}

interface Source {
  kit: Kit
  attachments: Map<number, Attachment>
  baseUrl: string
  pages: SourcePage[]
  others: OtherItem[]
}

const SKIPPED_STATUSES = new Set(['trash', 'auto-draft'])

function parseElements(
  source: string | undefined
): ElementorElement[] | undefined {
  if (!source) {
    return undefined
  }

  try {
    let value = JSON.parse(source) as unknown

    if (typeof value === 'string') {
      value = JSON.parse(value)
    }

    return Array.isArray(value) ? (value as ElementorElement[]) : undefined
  } catch {
    return undefined
  }
}

function readPageJson(source: string, input: string): Source {
  const data = JSON.parse(source) as {
    content?: unknown
    title?: unknown
    type?: unknown
  }
  const elements = Array.isArray(data.content)
    ? (data.content as ElementorElement[])
    : []
  const title =
    typeof data.title === 'string' && data.title ? data.title : 'Untitled'
  const type = typeof data.type === 'string' ? data.type : 'page'
  const id = /(\d+)/.exec(basename(input))?.[1]
  const others: OtherItem[] = []
  const pages: SourcePage[] = []

  if (type === 'page' || type === 'wp-page') {
    pages.push({
      id: id ? Number(id) : undefined,
      title,
      path: slugify(title) || 'page',
      status: 'draft',
      link: '',
      elements,
    })
  } else {
    others.push({
      kind: `Elementor ${type}`,
      title,
      detail: 'a template, not a page. v1 imports pages only.',
    })
  }

  return {
    kit: emptyKit(),
    attachments: new Map(),
    baseUrl: '',
    pages,
    others,
  }
}

function templateDetail(post: WxrPost): OtherItem | undefined {
  if (post.type === 'elementor-hf') {
    const kind = post.meta.ehf_template_type ?? ''
    const label = kind.includes('footer')
      ? 'Footer'
      : kind.includes('header')
        ? 'Header'
        : 'Header or footer'

    return {
      kind: label,
      title: post.title,
      detail: 'not imported. Headers and footers come in a later version.',
    }
  }

  if (post.type === 'elementor_library') {
    const type = post.meta._elementor_template_type ?? 'template'

    return {
      kind: `Elementor template (${type})`,
      title: post.title,
      detail:
        type === 'header' || type === 'footer'
          ? 'not imported. Theme builder templates come in a later version.'
          : 'not imported. v1 imports pages only.',
    }
  }

  return undefined
}

function readWxrSource(xml: string): Source {
  const wxr = readWxr(xml)
  const kitPost = wxr.posts.find((post) => isKit(post))
  const attachments = new Map<number, Attachment>(
    wxr.posts
      .filter((post) => post.type === 'attachment' && post.attachmentUrl)
      .map((post) => [
        post.id,
        {
          url: post.attachmentUrl,
          alt: post.meta._wp_attachment_image_alt?.trim() ?? '',
        },
      ])
  )
  const front =
    wxr.frontPageId ??
    wxr.posts.find((post) => post.type === 'page' && post.slug === 'home')?.id
  const paths = pagePaths(wxr.posts, front)
  const used = new Set<string>()
  const pages: SourcePage[] = []
  const others: OtherItem[] = []

  for (const post of wxr.posts) {
    if (isKit(post) || post.type === 'attachment') {
      continue
    }

    const template = templateDetail(post)

    if (template) {
      others.push(template)

      continue
    }

    const hasElementor = Boolean(post.meta._elementor_data)

    if (post.type !== 'page') {
      if (hasElementor) {
        others.push({
          kind: `Elementor content of type "${post.type}"`,
          title: post.title,
          detail: 'not imported. v1 imports pages only.',
        })
      }

      continue
    }

    if (SKIPPED_STATUSES.has(post.status)) {
      continue
    }

    const elements = parseElements(post.meta._elementor_data)

    if (!elements) {
      others.push({
        kind: 'Pages',
        title: post.title,
        detail: hasElementor
          ? 'the Elementor data could not be read.'
          : 'not built with Elementor. v1 imports Elementor pages only.',
      })

      continue
    }

    let path = paths.get(post.id) ?? slugify(post.title)

    if (used.has(path)) {
      path = `${path}-${post.id}`
    }

    used.add(path)

    pages.push({
      id: post.id,
      title: post.title || path,
      path,
      status: post.status,
      link: post.link,
      description: descriptionOf(post),
      publishedAt: publishedAt(post.date),
      elements,
    })
  }

  return {
    kit: kitPost ? kitFromPost(kitPost) : emptyKit(),
    attachments,
    baseUrl: wxr.baseUrl,
    pages,
    others,
  }
}

function mergeFonts(kit: Kit, used: Map<string, Set<string>>): FontUse[] {
  const fonts = new Map<string, Set<string>>()

  for (const font of kit.fonts) {
    fonts.set(font.family, new Set(font.weights))
  }

  for (const [family, weights] of used) {
    fonts.set(family, new Set([...(fonts.get(family) ?? []), ...weights]))
  }

  return [...fonts.entries()]
    .filter(([family]) => !SYSTEM_FONTS.has(family.toLowerCase()))
    .map(([family, weights]) => ({
      family,
      weights: [...weights].sort(),
    }))
}

function frontmatterOf(page: SourcePage, status: 'published' | 'draft') {
  return {
    title: page.title,
    status,
    description: page.description,
    publishedAt: status === 'published' ? page.publishedAt : undefined,
    wordpress: {
      id: page.id,
      link: page.link || undefined,
    },
  }
}

/** Reads a WordPress export (a WXR file) or an Elementor page JSON and writes a Pluto project. */
export async function runImport(options: ImportOptions): Promise<ImportResult> {
  const now = options.now ?? (() => new Date())
  const raw = await readFile(options.input, 'utf8')
  const source = raw.trimStart().startsWith('{')
    ? readPageJson(raw, options.input)
    : readWxrSource(raw)
  const useMedia = options.media !== false
  const dryRun = options.dryRun === true
  const results: PageResult[] = []
  const toWrite: {
    page: SourcePage
    result: PageResult
    nodes: ReturnType<typeof convertElements>
    images: Map<string, string>
    file: string
  }[] = []
  const fonts = new Map<string, Set<string>>()

  for (const page of source.pages) {
    const status = isPublished(page.status) ? 'published' : 'draft'
    const file = join(options.out, 'content/pages', `${page.path}.md`)
    const existing = await readIfExists(file)
    const result: PageResult = {
      wordpressId: page.id,
      title: page.title,
      path: page.path,
      status,
      action: dryRun ? 'planned' : 'written',
      blocks: 0,
      report: emptyReport(),
    }

    results.push(result)

    if (existing !== undefined && !options.force) {
      const known = (
        parseMarkdownFile(existing).frontmatter.wordpress as
          { id?: unknown } | undefined
      )?.id
      const same = page.id === undefined ? true : known === page.id

      result.action = same ? 'skipped' : 'conflict'
      result.reason = same
        ? 'a file with the same WordPress id is already there'
        : 'a file that is not from this page is already there'

      continue
    }

    const ctx: ConvertContext = {
      kit: source.kit,
      report: result.report,
      images: new Map(),
      attachments: source.attachments,
      baseUrl: source.baseUrl,
      fonts,
    }
    const nodes = convertElements(ctx, page.elements)

    result.blocks = nodes.length
    toWrite.push({ page, result, nodes, images: ctx.images, file })
  }

  const images = new Map<string, string>()

  for (const entry of toWrite) {
    for (const [url, alt] of entry.images) {
      if (!images.get(url)) {
        images.set(url, alt)
      }
    }
  }

  const media: MediaSummary = {
    enabled: useMedia,
    planned: images.size,
    downloaded: 0,
    reused: 0,
    failures: [],
  }
  let map = new Map<string, string>()

  if (useMedia && !dryRun && images.size > 0) {
    const imported = await importMedia(images, {
      root: options.out,
      fetch: options.fetch ?? fetch,
      now,
    })

    map = imported.map
    media.downloaded = imported.downloaded
    media.reused = imported.reused
    media.failures = imported.failures
  }

  const written: string[] = []

  for (const entry of toWrite) {
    if (dryRun) {
      continue
    }

    const body = serializeBlocks(rewriteMedia(entry.nodes, map))
    const text = serializeMarkdownFile(
      frontmatterOf(entry.page, entry.result.status),
      body ? `\n${body}\n` : ''
    )

    await writeFileDeep(entry.file, text)
    written.push(entry.file)
  }

  const theme =
    source.kit.theme.colors.primary || source.kit.theme.fonts.heading
      ? cleanTheme(source.kit.theme)
      : undefined
  const mergedFonts = mergeFonts(source.kit, fonts)

  const report = buildReport({
    source: basename(options.input),
    generatedAt: now().toISOString(),
    dryRun,
    pages: results,
    others: source.others,
    media,
    theme,
    fonts: mergedFonts,
  })

  if (!dryRun) {
    if (theme) {
      const themeFile = join(options.out, 'pluto-import/theme.json')

      await writeFileDeep(themeFile, `${JSON.stringify(theme, null, 2)}\n`)
      written.push(themeFile)
    }

    const reportFile = join(options.out, 'pluto-import-report.md')

    await writeFileDeep(reportFile, `${report}\n`)
    written.push(reportFile)
  }

  return {
    pages: results,
    others: source.others,
    media,
    theme,
    themeSnippet: theme ? themeSnippet(theme) : undefined,
    fonts: mergedFonts,
    report,
    written,
  }
}
