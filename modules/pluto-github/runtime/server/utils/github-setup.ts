import type { H3Event } from 'h3'
import type { PlutoGithubAccess } from '../adapter'
import type { PlutoGithubStore } from '../store/types'
import type { GithubCache } from './github-cache'
import type { GithubConfig } from './github-config'
import { resolve } from 'node:path'
import process from 'node:process'
import {
  registerContentAdapter,
  registerContentType,
} from '../../../../../server/utils/pluto-content'
import {
  registerMediaDriver,
} from '../../../../../server/utils/pluto-media-driver'
import {
  isPublicRead,
  markPublicRead,
} from '../../../../../server/utils/pluto-public-read'
import { plutoGithubPostType } from '../../shared/post-type'
import { createMarkdownContentAdapter } from '../adapter'
import { createAppTokenProvider } from '../github/app-token'
import { createGithubMediaDriver } from '../media'
import { createFsStore } from '../store/fs'
import { createGithubStore } from '../store/github'
import { createGithubCache } from './github-cache'
import { getGithubSession } from './session'

/**
 * Picks the store: the local files in dev with `fs`, otherwise GitHub. The
 * GitHub store reads for anonymous callers with the read token, or with an
 * installation token of the App. See `createAppTokenProvider`.
 */
export function createContentStore(
  config: GithubConfig,
  cache: GithubCache
): PlutoGithubStore {
  if (config.storage === 'fs') {
    // Only the content dir makes the head id. The root is the project dir.
    return createFsStore({
      root: resolve(config.fsRoot || process.cwd()),
      headDir: config.dir,
      gitCommit: config.localCommit,
    })
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
 * Makes the rest of this request anonymous. `getGithubAccess` then returns
 * `null` and never reads the session cookie. The public read routes call
 * this first, so a response never depends on who asks, and never sets a cookie.
 * It is the same as `markPublicRead` of core, which a layer can call too.
 */
export function markGithubAnonymous(event: H3Event): void {
  markPublicRead(event)
}

/**
 * The caller of a request. A signed-in user gives its own GitHub token and
 * capabilities. Everyone else is anonymous (`null`), and so is a request that
 * `markGithubAnonymous` marked.
 */
export async function getGithubAccess(
  event: H3Event
): Promise<PlutoGithubAccess | null> {
  if (isPublicRead(event)) {
    return null
  }
  const session = await getGithubSession(event)
  if (!session) {
    return null
  }
  return { capabilities: session.capabilities, auth: { token: session.token } }
}

let registeredCache: GithubCache | undefined
let registeredStore: PlutoGithubStore | undefined

/** The store that `registerGithubContent` made. The `/media/**` route reads from it. */
export function getRegisteredGithubStore(): PlutoGithubStore | undefined {
  return registeredStore
}

/** The cache that `registerGithubContent` got. A memory cache when none is set. */
export function getRegisteredGithubCache(): GithubCache {
  registeredCache ??= createGithubCache({ headTtl: 0 })
  return registeredCache
}

/** Registers the post type, the Markdown adapter and the media driver with core. */
export function registerGithubContent(
  config: GithubConfig,
  cache: GithubCache
): void {
  registeredCache = cache
  if (config.postType) {
    registerContentType(plutoGithubPostType)
  }
  const store = createContentStore(config, cache)
  registeredStore = store
  registerContentAdapter(
    createMarkdownContentAdapter({
      store,
      dir: config.dir,
      cache,
      commit: { skipDeploy: config.skipDeploy },
      getAccess: getGithubAccess,
    })
  )
  registerMediaDriver(
    createGithubMediaDriver({
      store,
      dir: config.dir,
      getAccess: getGithubAccess,
      skipDeploy: config.skipDeploy,
    })
  )
}
