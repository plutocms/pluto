import type { Nuxt } from '@nuxt/schema'
import type { PlutoDocsOptions } from './options'
import { join } from 'node:path'
import {
  addImports,
  addServerHandler,
  addVitePlugin,
  createResolver,
  defineNuxtModule,
  useLogger,
} from '@nuxt/kit'
import { PREVIEW_PATH } from '../../shared/utils/blocks/preview-protocol'
import {
  BLOCK_MACRO,
  BlockCatalog,
  blocksModuleSource,
  CONTENT_COMPONENTS_DIR,
  MACRO_KEY,
} from './blocks'
import { buildContentManifest, manifestModuleSource } from './manifest'
import { resolvePlutoDocsOptions } from './options'

export type { PlutoDocsOptions, PlutoDocsTypeOptions } from './options'

/** The routes of the run-time render mode, on the public API of Pluto. The composables of the layer call them. */
export const RUNTIME_ROUTE_BASE = '/api/pluto/v1/docs'

/**
 * Registers the content types of the docs layer. It is OFF when the
 * app turns the standalone CMS off (`plutoGithub.enabled: false`). The default
 * `'auto'` and `true` both count as on. The module only checks the options
 * and copies them to the public runtime config. The client plugin
 * (`app/plugins/pluto-docs.ts`) and the Nitro plugin
 * (`server/plugins/pluto-docs.ts`) of the layer build the types from
 * that config. See the docs-setup skill.
 */
export default defineNuxtModule<PlutoDocsOptions>({
  meta: { name: 'pluto-docs', configKey: 'plutoDocs' },
  defaults: { types: [] },
  setup(options, nuxt) {
    const logger = useLogger('pluto-docs')
    const cms = (
      nuxt.options as { plutoGithub?: { enabled?: boolean | 'auto' } }
    ).plutoGithub

    const { enabled, render, runtimeMaxAge, types, blocks, errors } =
      resolvePlutoDocsOptions(options, {
        cmsEnabled: cms?.enabled !== false,
      })

    for (const error of errors) {
      logger.error(error)
    }
    // `definePlutoBlock(...)` in a component file. A typed no-op at run time: the build reads the call.
    addImports({
      name: BLOCK_MACRO,
      from: createResolver(import.meta.url).resolve(
        '../../shared/utils/blocks/define'
      ),
    })

    // The editor imports the virtual module even when the layer is off, so it always exists.
    setupBlockDiscovery(nuxt, logger, enabled && blocks.discover)

    if (!enabled) {
      return
    }

    // The plugins read this key. It is absent when the layer is off.
    nuxt.options.runtimeConfig.public.plutoDocs = {
      types,
      render,
      runtimeMaxAge,
    }

    if (render === 'hybrid' || render === 'runtime') {
      const { resolve } = createResolver(import.meta.url)
      // The toc rules of Nuxt Content, so the run-time parser makes the same table of contents.
      const content = (
        nuxt.options as {
          content?: {
            build?: {
              markdown?: { toc?: { depth?: number; searchDepth?: number } }
            }
          }
        }
      ).content
      nuxt.options.runtimeConfig.plutoDocs = {
        toc: content?.build?.markdown?.toc,
      } as never
      for (const name of ['page', 'navigation', 'surround']) {
        addServerHandler({
          route: `${RUNTIME_ROUTE_BASE}/:type/${name}`,
          method: 'get',
          handler: resolve(`../../server/handlers/${name}.get`),
        })
      }
    }

    // The build manifest: content id → version, for each type. The server compares it with the
    // store (hybrid). It is a virtual module, so it is part of the server bundle and matches the
    // pages that Nuxt Content builds in the same run. It is made once, when the bundler first asks.
    const makeManifest = () => {
      // The CMS module sets the storage and the content dir. They are known here, after all modules ran.
      const cmsConfig = nuxt.options.runtimeConfig.public.plutoGithub as
        { storage?: string; dir?: string } | undefined
      return buildContentManifest(types, {
        contentDir: join(nuxt.options.rootDir, cmsConfig?.dir ?? 'content'),
        storage: cmsConfig?.storage ?? 'github',
      })
    }

    const manifestId = '#pluto-docs/manifest'
    let manifestSource: string | undefined
    nuxt.hook('nitro:config', (nitroConfig) => {
      nitroConfig.virtual ||= {}
      nitroConfig.virtual[manifestId] = () => {
        if (manifestSource === undefined) {
          manifestSource = manifestModuleSource(
            render === 'hybrid' ? makeManifest() : {}
          )
        }
        return manifestSource
      }
    })

    // The preview page of the visual editor is a client-only page that no search engine should list.
    // It is not prerendered, and the response says noindex. An app rule for the same path wins.
    nuxt.options.routeRules = {
      [PREVIEW_PATH]: {
        ssr: false,
        prerender: false,
        headers: { 'x-robots-tag': 'noindex, nofollow' },
      },
      ...nuxt.options.routeRules,
    }

    if (!nuxt.options._prepare) {
      logger.info(
        `Docs layer on. Types: ${types.map((type) => type.name).join(', ') || 'none'}. Render: ${render}.`
      )
    }
  },
})

/**
 * The component layer of the block editor. The virtual module `#pluto-docs/blocks` holds the blocks
 * of the `components/content/` folders. Only the two lazy editor roots import it, so it stays out of
 * the public pages. The server build gets an empty object: the editor never renders on the server.
 * The cost comes when the editor first loads, not at start-up. A change to a component file makes
 * the module load again, and the catalog parses only the file that changed.
 */
function setupBlockDiscovery(
  nuxt: Nuxt,
  logger: ReturnType<typeof useLogger>,
  discover: boolean
) {
  const id = '#pluto-docs/blocks'
  // The `\0` prefix marks a virtual id. No `#` in it: a browser URL ends at the `#`.
  const resolved = '\0pluto-docs-blocks'
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

  addVitePlugin({
    name: 'pluto-docs:blocks',
    enforce: 'pre',
    resolveId(source) {
      return source === id ? resolved : undefined
    },
    async load(loaded, options) {
      if (loaded !== resolved) {
        return undefined
      }
      if (options?.ssr || !discover) {
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
        const module = server.moduleGraph.getModuleById(resolved)
        if (module) {
          server.moduleGraph.invalidateModule(module)
          server.ws.send({ type: 'full-reload' })
        }
      }
      server.watcher.on('add', invalidate)
      server.watcher.on('unlink', invalidate)
    },
    handleHotUpdate({ file, server }) {
      if (!isBlockFile(file)) {
        return undefined
      }
      const module = server.moduleGraph.getModuleById(resolved)
      return module ? [module] : undefined
    },
  })
}
