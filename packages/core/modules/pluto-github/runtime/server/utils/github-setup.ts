import type { H3Event } from 'h3'
import type { PlutoGithubAccess } from '../adapter'
import type { AppTokenProvider } from '../github/app-token'
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
import { isPlutoSystemEvent } from '../../../../../server/utils/pluto-system'
import { plutoGithubAuthorType } from '../../shared/author-type'
import { plutoGithubPostType } from '../../shared/post-type'
import { plutoGithubTermTypes } from '../../shared/term-types'
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

let registeredTokens: AppTokenProvider | undefined

export function createContentStore(
  config: GithubConfig,
  cache: GithubCache,
  loadSnapshot?: SnapshotLoader
): PlutoGithubStore {
  if (config.storage === 'fs') {
    registeredTokens = undefined
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
  registeredTokens = tokens
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

export function markGithubAnonymous(event: H3Event): void {
  markPublicRead(event)
}

export async function getGithubAccess(
  event: H3Event
): Promise<PlutoGithubAccess | null> {
  if (isPlutoSystemEvent(event)) {
    return systemAccess()
  }
  if (isPublicRead(event)) {
    return null
  }
  const session = await getGithubSession(event)
  if (!session) {
    return null
  }
  return { capabilities: session.capabilities, auth: { token: session.token } }
}

async function systemAccess(): Promise<PlutoGithubAccess | null> {
  if (!registeredTokens) {
    return { capabilities: ['*'], auth: { token: '' } }
  }
  try {
    return {
      capabilities: ['*'],
      auth: { token: await registeredTokens.getWriteToken() },
    }
  } catch {
    return null
  }
}

let registeredCache: GithubCache | undefined
let registeredStore: PlutoGithubStore | undefined

export function getRegisteredGithubStore(): PlutoGithubStore | undefined {
  return registeredStore
}

export function getRegisteredGithubCache(): GithubCache {
  registeredCache ??= createGithubCache({ headTtl: 0 })
  return registeredCache
}

export function registerGithubContent(
  config: GithubConfig,
  cache: GithubCache,
  loadSnapshot?: SnapshotLoader
): void {
  registeredCache = cache
  if (config.postType) {
    registerContentType(plutoGithubPostType)
    for (const type of plutoGithubTermTypes) {
      registerContentType(type)
    }
    registerContentType(plutoGithubAuthorType)
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
