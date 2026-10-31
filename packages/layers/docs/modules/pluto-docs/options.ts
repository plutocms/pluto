/** One content type that the layer builds from a preset. */
export interface PlutoDocsTypeOptions {
  /** The preset that makes the type. Only `docs` exists. */
  preset: 'docs'
  /** The content type name. It is a URL segment: `/admin/content/<name>`. */
  name: string
  /**
   * The folder of the pages, under the CMS content dir. Use `''` for the content
   * dir itself (the usual case for a Nuxt Content site).
   */
  source: string
  label?: string
  labelPlural?: string
  /** The Iconify name of the type in the admin (sidebar, New menu, dashboard). Default `lucide:book-open`. */
  icon?: string
  /** Ids that the type must not list or edit. An id (`index`), or a folder with a trailing slash (`drafts/`). */
  exclude?: string[]
  /** The route prefix of the pages on the public site, for the View link of the form. Default: none. */
  routePrefix?: string
  /**
   * The nav group of the type in the admin sidebar and the admin bar. Default `'pages'` (core's
   * group). A string is a group id. `false` gives the type its own sidebar item.
   */
  navGroup?: string | false
}

/** How the public pages get their content. See the docs-setup skill. */
export type PlutoDocsRender = 'hybrid' | 'build' | 'runtime'

export interface PlutoDocsOptions {
  /** The content types to register. Default: none. */
  types?: PlutoDocsTypeOptions[]
  /**
   * `'hybrid'` (default): the pages are built with the site, and the server reads from the content
   * repository the pages that changed after the build. `'build'`: Nuxt Content builds the pages
   * and nothing else. `'runtime'`: the server reads every page from the repository at request time.
   */
  render?: PlutoDocsRender
  /**
   * Seconds that a CDN may cache the answers of the layer routes (`hybrid` and `runtime`). Default 10.
   * It is short, so a save shows soon. `0` turns the cache header into `no-store`.
   */
  runtimeMaxAge?: number
  /** How the block editor finds the block components of the site. */
  blocks?: PlutoDocsBlocksOptions
}

export interface PlutoDocsBlocksOptions {
  /**
   * Read `components/content/` of the app and of its layers. A component that calls
   * `definePlutoBlock(...)` becomes a block. Default `true`. `false` turns the search off.
   */
  discover?: boolean
}

export interface PlutoDocsResolveContext {
  /** False when the app sets `plutoGithub.enabled` to false. */
  cmsEnabled: boolean
}

export interface PlutoDocsResolveResult {
  enabled: boolean
  render: PlutoDocsRender
  runtimeMaxAge: number
  blocks: { discover: boolean }
  types: PlutoDocsTypeOptions[]
  errors: string[]
}

export const PLUTO_DOCS_PRESETS = ['docs'] as const
export const PLUTO_DOCS_RENDER_MODES = ['hybrid', 'build', 'runtime'] as const
export const DEFAULT_RUNTIME_MAX_AGE = 10

export const CMS_OFF_ERROR =
  'The docs layer needs the standalone CMS. Remove plutoGithub.enabled: false, or remove the layer.'

const NAME_PATTERN = /^[a-z][a-z0-9-]*$/
const SOURCE_SEGMENT = /^(?:\d+\.)?[a-z0-9]+(?:-[a-z0-9]+)*$/

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/** Whether `source` is `''` or a safe nested path (the same segment rule as the CMS). */
export function isValidSource(source: unknown): source is string {
  if (typeof source !== 'string') {
    return false
  }
  if (source === '') {
    return true
  }
  const segments = source.split('/')
  return (
    segments.length <= 6 &&
    segments.every((segment) => SOURCE_SEGMENT.test(segment))
  )
}

/** Normalizes a route prefix to `/a/b`, or `''` for none. */
export function normalizeRoutePrefix(prefix: unknown): string {
  if (typeof prefix !== 'string') {
    return ''
  }
  const segments = prefix.split('/').filter(Boolean)
  return segments.length > 0 ? `/${segments.join('/')}` : ''
}

/**
 * Checks the module options. A type with a problem is dropped and gives one
 * error. When the CMS is off, the layer is off and gives one error. This file
 * has no Nuxt import, so plain Vitest tests it.
 */
export function resolvePlutoDocsOptions(
  options: PlutoDocsOptions,
  ctx: PlutoDocsResolveContext
): PlutoDocsResolveResult {
  const errors: string[] = []

  if (!ctx.cmsEnabled) {
    return {
      enabled: false,
      render: 'build',
      runtimeMaxAge: DEFAULT_RUNTIME_MAX_AGE,
      blocks: { discover: false },
      types: [],
      errors: [CMS_OFF_ERROR],
    }
  }

  let render: PlutoDocsRender = 'hybrid'
  if (options.render !== undefined) {
    if (
      (PLUTO_DOCS_RENDER_MODES as readonly unknown[]).includes(options.render)
    ) {
      render = options.render
    } else {
      errors.push(
        `plutoDocs.render must be one of: ${PLUTO_DOCS_RENDER_MODES.join(', ')}. Using "hybrid".`
      )
    }
  }

  let runtimeMaxAge = DEFAULT_RUNTIME_MAX_AGE
  if (options.runtimeMaxAge !== undefined) {
    if (
      typeof options.runtimeMaxAge === 'number' &&
      Number.isInteger(options.runtimeMaxAge) &&
      options.runtimeMaxAge >= 0
    ) {
      runtimeMaxAge = options.runtimeMaxAge
    } else {
      errors.push(
        `plutoDocs.runtimeMaxAge must be a whole number of seconds, 0 or more. Using ${DEFAULT_RUNTIME_MAX_AGE}.`
      )
    }
  }

  let discover = true
  if (options.blocks !== undefined) {
    if (!isRecord(options.blocks)) {
      errors.push('plutoDocs.blocks must be an object.')
    } else if (options.blocks.discover !== undefined) {
      if (typeof options.blocks.discover === 'boolean') {
        discover = options.blocks.discover
      } else {
        errors.push(
          'plutoDocs.blocks.discover must be true or false. Using true.'
        )
      }
    }
  }

  const types: PlutoDocsTypeOptions[] = []
  const names = new Set<string>()
  const entries: unknown[] = Array.isArray(options.types) ? options.types : []

  for (const [index, entry] of entries.entries()) {
    const where = `plutoDocs.types[${index}]`
    if (!isRecord(entry)) {
      errors.push(`${where} must be an object.`)
      continue
    }
    if (!(PLUTO_DOCS_PRESETS as readonly unknown[]).includes(entry.preset)) {
      errors.push(
        `${where}.preset must be one of: ${PLUTO_DOCS_PRESETS.join(', ')}.`
      )
      continue
    }
    if (typeof entry.name !== 'string' || !NAME_PATTERN.test(entry.name)) {
      errors.push(
        `${where}.name must use lowercase letters, numbers and dashes, and start with a letter.`
      )
      continue
    }
    if (names.has(entry.name)) {
      errors.push(`${where}.name "${entry.name}" is used twice.`)
      continue
    }
    if (!isValidSource(entry.source)) {
      errors.push(
        `${where}.source must be '' or a folder path such as "docs" or "1.docs/api".`
      )
      continue
    }
    if (
      entry.exclude !== undefined &&
      !(
        Array.isArray(entry.exclude) &&
        entry.exclude.every((item) => typeof item === 'string')
      )
    ) {
      errors.push(`${where}.exclude must be a list of strings.`)
      continue
    }
    if (
      entry.navGroup !== undefined &&
      entry.navGroup !== false &&
      !(typeof entry.navGroup === 'string' && entry.navGroup !== '')
    ) {
      errors.push(`${where}.navGroup must be a group id, or false.`)
      continue
    }
    if (
      entry.icon !== undefined &&
      !(typeof entry.icon === 'string' && entry.icon !== '')
    ) {
      errors.push(`${where}.icon must be an icon name.`)
      continue
    }
    names.add(entry.name)
    types.push({
      preset: 'docs',
      name: entry.name,
      source: entry.source,
      ...(typeof entry.label === 'string' && { label: entry.label }),
      ...(typeof entry.labelPlural === 'string' && {
        labelPlural: entry.labelPlural,
      }),
      ...(typeof entry.icon === 'string' && { icon: entry.icon }),
      ...(Array.isArray(entry.exclude) && {
        exclude: entry.exclude as string[],
      }),
      routePrefix: normalizeRoutePrefix(entry.routePrefix),
      ...((typeof entry.navGroup === 'string' || entry.navGroup === false) && {
        navGroup: entry.navGroup,
      }),
    })
  }

  return {
    enabled: true,
    render,
    runtimeMaxAge,
    blocks: { discover },
    types,
    errors,
  }
}
