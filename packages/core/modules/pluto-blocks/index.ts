import type { Nuxt } from '@nuxt/schema'
import type { ViteDevServer } from 'vite'
import { join } from 'node:path'
import {
  addImports,
  addVitePlugin,
  createResolver,
  defineNuxtModule,
  useLogger,
} from '@nuxt/kit'
import {
  BLOCK_MACRO,
  BlockCatalog,
  blockComponentFiles,
  blocksModuleSource,
  componentsModuleSource,
  CONTENT_COMPONENTS_DIR,
  MACRO_KEY,
} from './catalog'

export default defineNuxtModule({
  meta: { name: 'pluto-blocks' },
  setup(_options, nuxt) {
    const logger = useLogger('pluto-blocks')
    const { resolve } = createResolver(import.meta.url)

    addImports({
      name: BLOCK_MACRO,
      from: resolve('../../shared/utils/blocks/define'),
    })

    setupBlockModules(nuxt, logger)
  },
})

function setupBlockModules(nuxt: Nuxt, logger: ReturnType<typeof useLogger>) {
  const ids = {
    blocks: '#pluto-blocks',
    components: '#pluto-block-components',
  }
  const resolved = {
    blocks: '\0pluto-blocks',
    components: '\0pluto-block-components',
  }
  const dirs = () =>
    nuxt.options._layers.map((layer) =>
      join(layer.config.srcDir, CONTENT_COMPONENTS_DIR)
    )

  const slashes = (path: string) => path.replaceAll('\\', '/')

  type Reader = typeof import('nuxt-component-meta/parser').getComponentMeta
  let getComponentMeta: Reader | undefined
  const catalog = new BlockCatalog(
    dirs,
    (file) =>
      getComponentMeta!(slashes(file), {
        rootDir: nuxt.options.rootDir,
        cache: true,
        cacheDir: join(nuxt.options.buildDir, 'cache/pluto-blocks'),
        extendMetaFunctions: [
          { name: BLOCK_MACRO, transform: (arg) => ({ [MACRO_KEY]: arg }) },
        ],
      }) as never,
    logger
  )

  const isBlockFile = (file: string) =>
    file.endsWith('.vue') &&
    dirs().some((dir) => slashes(file).startsWith(slashes(dir)))

  const reload = (server: ViteDevServer) => {
    for (const id of Object.values(resolved)) {
      const module = server.moduleGraph.getModuleById(id)
      if (module) {
        server.moduleGraph.invalidateModule(module)
      }
    }
  }

  addVitePlugin({
    name: 'pluto:blocks',
    enforce: 'pre',
    resolveId(source) {
      if (source === ids.blocks) {
        return resolved.blocks
      }
      return source === ids.components ? resolved.components : undefined
    },
    async load(loaded, options) {
      if (loaded === resolved.components) {
        return componentsModuleSource(
          blockComponentFiles(dirs()).map((file) => ({
            ...file,
            file: slashes(file.file),
          }))
        )
      }
      if (loaded !== resolved.blocks) {
        return undefined
      }
      if (options?.ssr) {
        return blocksModuleSource({})
      }
      getComponentMeta ||= (await import('nuxt-component-meta/parser'))
        .getComponentMeta
      return blocksModuleSource(catalog.collect())
    },
    configureServer(server) {
      const invalidate = (file: string) => {
        if (!isBlockFile(file)) {
          return
        }
        reload(server)
        server.ws.send({ type: 'full-reload' })
      }
      server.watcher.on('add', invalidate)
      server.watcher.on('unlink', invalidate)
    },
    handleHotUpdate({ file, server, modules }) {
      if (!isBlockFile(file)) {
        return undefined
      }
      const virtual = Object.values(resolved)
        .map((id) => server.moduleGraph.getModuleById(id))
        .filter((module) => module !== undefined)
      return [...modules, ...virtual]
    },
  })
}
