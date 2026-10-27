import type { H3Event } from 'h3'
import type { PlutoCmsAccess } from '../adapter'
import type { PlutoCmsStore } from '../store/types'
import type { CmsCache } from './cms-cache'
import type { CmsConfig } from './cms-config'
import { resolve } from 'node:path'
import process from 'node:process'
import { registerContentAdapter, registerContentType } from '../../../../../server/utils/pluto-content'
import { isPublicRead, markPublicRead } from '../../../../../server/utils/pluto-public-read'
import { plutoCmsPostType } from '../../shared/post-type'
import { createMarkdownContentAdapter } from '../adapter'
import { createAppTokenProvider } from '../github/app-token'
import { createFsStore } from '../store/fs'
import { createGithubStore } from '../store/github'
import { createCmsCache } from './cms-cache'
import { getCmsSession } from './session'

/**
 * Picks the store: the local files in dev with `fs`, otherwise GitHub. The
 * GitHub store reads for anonymous callers with the read token, or with an
 * installation token of the App. See `createAppTokenProvider`.
 */
export function createCmsStore(config: CmsConfig, cache: CmsCache): PlutoCmsStore {
  if (config.storage === 'fs') {
    // Only the content dir makes the head id. The root is the project dir.
    return createFsStore({ root: resolve(config.fsRoot || process.cwd()), headDir: config.dir })
  }
  const tokens = createAppTokenProvider({
    repo: config.repo,
    apiUrl: config.apiUrl,
    appId: config.appId,
    privateKey: config.privateKey,
    readToken: config.readToken,
    fetch: config.fetch,
  })
  return createGithubStore({
    repo: config.repo,
    branch: config.branch,
    apiUrl: config.apiUrl,
    cache,
    fetch: config.fetch,
    readToken: () => tokens.getReadToken(),
  })
}

/**
 * Makes the rest of this request anonymous. `getCmsAccess` then returns
 * `null` and never reads the session cookie. The public read routes call
 * this first, so a response never depends on who asks, and never sets a cookie.
 * It is the same as `markPublicRead` of core, which a layer can call too.
 */
export function markCmsAnonymous(event: H3Event): void {
  markPublicRead(event)
}

/**
 * The caller of a request. A signed-in user gives its own GitHub token and
 * capabilities. Everyone else is anonymous (`null`), and so is a request that
 * `markCmsAnonymous` marked.
 */
export async function getCmsAccess(event: H3Event): Promise<PlutoCmsAccess | null> {
  if (isPublicRead(event)) {
    return null
  }
  const session = await getCmsSession(event)
  if (!session) {
    return null
  }
  return { capabilities: session.capabilities, auth: { token: session.token } }
}

let registeredCache: CmsCache | undefined

/** The cache that `registerCmsContent` got. A memory cache when none is set. */
export function getRegisteredCmsCache(): CmsCache {
  registeredCache ??= createCmsCache({ headTtl: 0 })
  return registeredCache
}

/** Registers the post type and the Markdown adapter with the core content registry. */
export function registerCmsContent(config: CmsConfig, cache: CmsCache): void {
  registeredCache = cache
  if (config.postType) {
    registerContentType(plutoCmsPostType)
  }
  registerContentAdapter(createMarkdownContentAdapter({
    store: createCmsStore(config, cache),
    dir: config.dir,
    cache,
    commit: { skipDeploy: config.skipDeploy },
    getAccess: getCmsAccess,
  }))
}
