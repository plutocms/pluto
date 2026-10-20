import { vi } from 'vitest'

type Pages = {
 name?: string
path: string
file?: string
children?: Pages
}[]

/** What the module asked `@nuxt/kit` to add. A test reads it after it runs the module. */
export const kitCalls = {
  serverHandlers: [] as Record<string, unknown>[],
  serverPlugins: [] as string[],
  plugins: [] as unknown[],
  routeMiddleware: [] as Record<string, unknown>[],
  importsDirs: [] as string[],
  components: [] as Record<string, unknown>[],
  pageExtenders: [] as ((pages: Pages) => void)[],
}

export function resetKitCalls(): void {
  kitCalls.serverHandlers.length = 0
  kitCalls.serverPlugins.length = 0
  kitCalls.plugins.length = 0
  kitCalls.routeMiddleware.length = 0
  kitCalls.importsDirs.length = 0
  kitCalls.components.length = 0
  kitCalls.pageExtenders.length = 0
}

export function countKitCalls(): number {
  return Object.values(kitCalls).reduce((sum, list) => sum + list.length, 0)
}

/** Replaces the `add*` functions of `@nuxt/kit` with recorders. Everything else stays real. */
export function kitMock<T extends object>(actual: T): T {
  return {
    ...actual,
    addServerHandler: vi.fn((handler: Record<string, unknown>) => kitCalls.serverHandlers.push(handler)),
    addServerPlugin: vi.fn((path: string) => kitCalls.serverPlugins.push(path)),
    addPlugin: vi.fn((plugin: unknown) => kitCalls.plugins.push(plugin)),
    addRouteMiddleware: vi.fn((middleware: Record<string, unknown>) => kitCalls.routeMiddleware.push(middleware)),
    addComponent: vi.fn((component: Record<string, unknown>) => kitCalls.components.push(component)),
    addImportsDir: vi.fn((dir: string) => kitCalls.importsDirs.push(dir)),
    extendPages: vi.fn((extender: (pages: Pages) => void) => kitCalls.pageExtenders.push(extender)),
  }
}
