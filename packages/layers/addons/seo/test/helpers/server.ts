// A server for the handler tests, with no Nitro. It registers the post type of the Git CMS with
// the SEO extension and the Markdown adapter of core over the memory store, and stubs the names
// that Nitro auto-imports in the handlers. Everything else is the real code of core and of the layer.

import type { H3Event } from 'h3'
import { vi } from 'vitest'
import { createMarkdownContentAdapter } from '../../../../../core/modules/pluto-github/runtime/server/adapter'
import { createMemoryStore } from '../../../../../core/modules/pluto-github/runtime/server/store/memory'
import { plutoGithubPostType } from '../../../../../core/modules/pluto-github/runtime/shared/post-type'
import {
  extendContentTypes,
  getContentType,
  listContentTypes,
  registerContentAdapter,
  registerContentType,
} from '../../../../../core/server/utils/pluto-content'
import { requireContentAdapter } from '../../../../../core/server/utils/pluto-content-handlers'
import { registerMediaDriver } from '../../../../../core/server/utils/pluto-media-driver'
import {
  isPublishedItem,
  parsePublicQuery,
  toPublicData,
} from '../../../../../core/server/utils/pluto-public-api'
import { markPublicRead } from '../../../../../core/server/utils/pluto-public-read'
import { absoluteSiteUrl } from '../../../../../core/shared/utils/url'
import { plutoSeoListEntries } from '../../server/utils/seo-entries'
import { plutoSeoTypeExtension } from '../../shared/utils/seo-fields'
import { plutoSeoDescription } from '../../shared/utils/seo-head'
import {
  PLUTO_SEO_FEED_MAX,
  PLUTO_SEO_SITEMAP_MAX,
  plutoSeoRenderRobots,
  plutoSeoRenderRss,
  plutoSeoRenderSitemap,
} from '../../shared/utils/seo-xml'

/** The default settings of the layer, as `app/app.config.ts` gives them. */
export function defaultSeoConfig(
  extra: Record<string, unknown> = {}
): Record<string, any> {
  return {
    types: { post: true },
    image: '',
    twitterSite: '',
    indexable: true,
    sitemap: { paths: ['/'], exclude: {} },
    robots: { disallow: [] },
    feed: {
      type: 'post',
      title: '',
      description: '',
      language: '',
      limit: 20,
    },
    ...extra,
  }
}

/** A fake H3 event: the headers that a handler sets are in `headers`. */
export interface FakeEvent {
  context: Record<string, unknown>
  headers: Record<string, string>
  node: {
    res: {
      setHeader: (name: string, value: string) => void
      getHeader: (name: string) => string | undefined
    }
  }
}

function fakeEvent(): FakeEvent {
  const headers: Record<string, string> = {}
  return {
    context: {},
    headers,
    node: {
      res: {
        setHeader: (name, value) => {
          headers[name] = value
        },
        getHeader: (name) => headers[name],
      },
    },
  }
}

export interface SeoServerOptions {
  /** The files of the memory store, by path (`content/posts/hello.md`). */
  files?: Record<string, string>
  /** The settings of the layer. */
  config?: Record<string, any>
  /** The site root that `getPlutoSiteRoot` gives. `null`: not known. */
  root?: string | null
  /** The runtime config of the site. */
  runtime?: { websiteName?: string; websiteDescription?: string }
  baseURL?: string
}

/** A post file with the frontmatter that the test gives. */
export function postFile(
  frontmatter: Record<string, string | boolean>,
  body = 'Body of the post.'
): string {
  const lines = Object.entries(frontmatter).map(
    ([key, value]) => `${key}: ${value}`
  )
  return `---\n${lines.join('\n')}\n---\n${body}\n`
}

/** Registers everything and stubs the globals. Call `vi.unstubAllGlobals()` after the test. */
export function setupSeoServer(options: SeoServerOptions = {}) {
  const config = defaultSeoConfig(options.config)
  const root = options.root === undefined ? 'https://example.com' : options.root
  const store = createMemoryStore(options.files)
  const adapter = createMarkdownContentAdapter({
    store,
    dir: 'content',
    now: () => new Date('2026-03-01T00:00:00Z'),
    getAccess: async () => ({
      capabilities: ['posts:read_drafts'],
      auth: { token: 't' },
    }),
  })
  registerContentType(plutoGithubPostType)
  extendContentTypes(plutoSeoTypeExtension(config as never))
  registerContentAdapter(adapter)
  registerMediaDriver({
    get: async (_event: H3Event, ids: string[]) =>
      ids.map((id) => ({
        id,
        url: `/media/${id}.webp`,
        width: 1200,
        height: 630,
        alt: 'Alt text',
      })),
  } as never)

  const globals: Record<string, unknown> = {
    useAppConfig: () => ({ plutoSeo: config }),
    useRuntimeConfig: () => ({
      public: options.runtime ?? {},
      app: { baseURL: options.baseURL ?? '/' },
    }),
    getPlutoSiteRoot: () => root,
    setPublicApiCache: (event: FakeEvent) => {
      event.headers['Cache-Control'] = 'public, s-maxage=60'
    },
    absoluteSiteUrl,
    getContentType,
    listContentTypes,
    requireContentAdapter,
    markPublicRead,
    parsePublicQuery,
    isPublishedItem,
    toPublicData,
    plutoSeoListEntries,
    plutoSeoDescription,
    plutoSeoRenderSitemap,
    plutoSeoRenderRss,
    plutoSeoRenderRobots,
    PLUTO_SEO_SITEMAP_MAX,
    PLUTO_SEO_FEED_MAX,
  }
  for (const [name, value] of Object.entries(globals)) {
    vi.stubGlobal(name, value)
  }

  return {
    store,
    adapter,
    config,
    event: fakeEvent,
  }
}
