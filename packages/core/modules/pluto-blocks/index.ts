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

/**
 * The block components of a site: the files of `components/content/` (the app and its layers) that
 * call `definePlutoBlock(...)`. Two Vite virtual modules:
 *
 * - `#pluto-blocks`: the block definitions (props, slots, label, icon), from the TypeScript meta
 *   and the macro. Only the editors import it (the block editor of the docs layer, the component
 *   chip of the post editor), so it stays out of the public pages. The server build gets an empty
 *   object. The parser loads with the first import, not at start-up, and parses only a changed file.
 * - `#pluto-block-components`: a loader for each such file, by its kebab name. `PlutoHtml` renders a
 *   component of a post with it, on the server and in the browser. A text check finds the macro:
 *   no parse.
 *
 * See the content-components skill.
 */
export default defineNuxtModule({
  meta: { name: 'pluto-blocks' },
  setup(_options, nuxt) {
    const logger = useLogger('pluto-blocks')
    const { resolve } = createResolver(import.meta.url)

    // `definePlutoBlock(...)` in a component file. A typed no-op at run time: the build reads the call.
    addImports({
      name: BLOCK_MACRO,
      from: resolve('../../shared/utils/blocks/define'),
    })

    setupBlockModules(nuxt, logger)
  },
})

function setupBlockModules(
  nuxt: Nuxt,
  logger: ReturnType<typeof useLogger>
) {
  const ids = {
    blocks: '#pluto-blocks',
    components: '#pluto-block-components',
  }
  // The `\0` prefix marks a virtual id. No `#` in it: a browser URL ends at the `#`.
  const resolved = {
    blocks: '\0pluto-blocks',
    components: '\0pluto-block-components',
  }
  // The app first, then its layers (the order of priority).
  const dirs = () =>
    nuxt.options._layers.map((layer) =>
      join(layer.config.srcDir, CONTENT_COMPONENTS_DIR)
    )

  // The cache of the parser names a file from the text after the last slash, so give it slashes.
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
      // The parser loads here, not at start-up, because it brings the TypeScript compiler.
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
      // A file can get or lose the macro: both virtual modules load again, with the component.
      const virtual = Object.values(resolved)
        .map((id) => server.moduleGraph.getModuleById(id))
        .filter((module) => module !== undefined)
      return [...modules, ...virtual]
    },
  })
}
