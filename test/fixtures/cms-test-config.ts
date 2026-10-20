import type { CmsConfig } from '../../modules/pluto-cms/runtime/server/utils/cms-config'
import type { createFakeGithub } from './fake-github'

export const SESSION_PASSWORD = 'a-test-password-with-at-least-32-characters'

function baseConfig(): CmsConfig {
  return {
    dev: false,
    storage: 'github',
    repo: 'acme/site',
    branch: 'main',
    appSlug: 'acme-cms',
    apiUrl: 'https://api.github.com',
    dir: 'content',
    fsRoot: '',
    skipDeploy: false,
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
 * The config that the mocked `cms-config` module returns. A test file mocks
 * `getCmsConfig` with `() => testConfig`, then calls `resetTestConfig`. This
 * file imports no route, so the mock factory can load it without a cycle.
 */
export const testConfig: CmsConfig = baseConfig()

export function resetTestConfig(fake?: ReturnType<typeof createFakeGithub>, patch: Partial<CmsConfig> = {}): CmsConfig {
  for (const key of Object.keys(testConfig)) {
    delete (testConfig as unknown as Record<string, unknown>)[key]
  }
  Object.assign(testConfig, baseConfig(), { fetch: fake?.fetch }, patch)
  return testConfig
}
