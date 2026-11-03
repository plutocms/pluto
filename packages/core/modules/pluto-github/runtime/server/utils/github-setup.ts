import type { H3Event } from 'h3'
import type { PlutoGithubAccess } from '../adapter'
import type { SnapshotLoader } from '../store/snapshot'
import type { PlutoGithubStore } from '../store/types'
import type { GithubCache } from './github-cache'
import type { GithubConfig } from './github-config'
import { resolve } from 'node:path'
import process from 'node:process'
import {
  registerContentAdapter,
  registerContentType,
} from '../../../../../server/utils/pluto-content'
import { registerMediaDriver } from '../../../../../server/utils/pluto-media-driver'
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
import {
  createSnapshotStore,
  withBuildSnapshot,
  withSnapshotFallback,
} from '../store/snapshot'
import { createGithubCache } from './github-cache'
import { getGithubSession } from './session'

/**
 * Picks the store: the local files in dev with `fs`, otherwise GitHub. The
 * GitHub store reads for anonymous callers with the read token, or with an
 * installation token of the App. See `createAppTokenProvider`. The build bundles the content
 * (`loadSnapshot`). With neither (a first deploy, before the App), anonymous reads go to it. With
 * one, they go to GitHub, and to the bundled content when GitHub fails (hybrid).
 */
export function createContentStore(
  config: GithubConfig,
  cache: GithubCache,
  loadSnapshot?: SnapshotLoader
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
  const github = createGithubStore({
    repo: config.repo,
    branch: config.branch,
    apiUrl: config.apiUrl,
    cache,
    fetch: config.fetch,
    readToken: () => tokens.getReadToken(),
  })
  const canRead = Boolean(
    config.readToken || (config.appId && config.privateKey)
  )
  if (!loadSnapshot) {
    return github
  }
  if (canRead) {
    // At most one warning in 5 minutes, so an outage does not flood the log.
    let warnedAt = -Infinity
    return withSnapshotFallback(
      github,
      createSnapshotStore(loadSnapshot),
      (error) => {
        if (Date.now() - warnedAt < 5 * 60_000) {
          return
        }
        warnedAt = Date.now()
        console.warn(
          `[pluto-github] GitHub did not answer (${error instanceof Error ? error.message : String(error)}): the public pages show the content of the last build.`
        )
      }
    )
  }
  let told = false
  return withBuildSnapshot(github, createSnapshotStore(loadSnapshot), () => {
    if (!told) {
      told = true
      console.warn(
        '[pluto-github] No GitHub read token or App yet: the public pages show the content of the last build. Set up the GitHub App in /admin to read the repo live.'
      )
    }
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
  cache: GithubCache,
  loadSnapshot?: SnapshotLoader
): void {
  registeredCache = cache
  if (config.postType) {
    registerContentType(plutoGithubPostType)
  }
  const store = createContentStore(config, cache, loadSnapshot)
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
    })
  )
}
