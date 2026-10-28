import type { GithubConfig } from '../../modules/pluto-github/runtime/server/utils/github-config'
import type { createFakeGithub } from './fake-github'

export const SESSION_PASSWORD = 'a-test-password-with-at-least-32-characters'

function baseConfig(): GithubConfig {
  return {
    dev: false,
    storage: 'github',
    repo: 'acme/site',
    branch: 'main',
    appSlug: 'acme-cms',
    apiUrl: 'https://api.github.com',
    dir: 'content',
    fsRoot: '',
    rootDir: '',
    siteName: 'Acme',
    skipDeploy: false,
    localCommit: false,
    headTtl: 0,
    cacheStorage: 'cache',
    postType: true,
    sessionPassword: SESSION_PASSWORD,
    appId: '',
    clientId: 'client-id',
    clientSecret: 'client-secret',
    privateKey: '',
    readToken: '',
    allowedUsers: [],
  }
}

/**
 * The config that the mocked `github-config` module returns. A test file mocks
 * `getGithubConfig` with `() => testConfig`, then calls `resetTestConfig`. This
 * file imports no route, so the mock factory can load it without a cycle.
 */
export const testConfig: GithubConfig = baseConfig()

export function resetTestConfig(
  fake?: ReturnType<typeof createFakeGithub>,
  patch: Partial<GithubConfig> = {}
): GithubConfig {
  for (const key of Object.keys(testConfig)) {
    delete (testConfig as unknown as Record<string, unknown>)[key]
  }
  Object.assign(testConfig, baseConfig(), { fetch: fake?.fetch }, patch)
  return testConfig
}
