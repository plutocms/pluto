import type { Nuxt } from '@nuxt/schema'
import type { ContentCollection } from './collections'
import type { PlutoDocsOptions, PlutoDocsResolveResult } from './options'
import { join } from 'node:path'
import {
  addServerHandler,
  createResolver,
  defineNuxtModule,
  useLogger,
} from '@nuxt/kit'
import { PREVIEW_PATH } from '../../shared/utils/blocks/preview-protocol'
import { collectionTypes } from './collections'
import { buildContentManifest, manifestModuleSource } from './manifest'
import { resolvePlutoDocsOptions } from './options'

export type { PlutoDocsOptions, PlutoDocsTypeOptions } from './options'

/** The routes of the run-time render mode, on the public API of Pluto. The composables of the layer call them. */
export const RUNTIME_ROUTE_BASE = '/api/pluto/v1/docs'

/** The template of Nuxt Content that holds its resolved collections (an internal of Nuxt Content). */
const CONTENT_MANIFEST_TEMPLATE = 'content/manifest.ts'

/** The collections that Nuxt Content resolved, or undefined when its manifest template is not there. */
function contentCollections(nuxt: Nuxt): ContentCollection[] | undefined {
  const template = nuxt.options.build.templates.find(
    (item) => item.filename === CONTENT_MANIFEST_TEMPLATE
  )
  const collections = (
    template?.options as { manifest?: { collections?: unknown } } | undefined
  )?.manifest?.collections
  return Array.isArray(collections)
    ? (collections as ContentCollection[])
    : undefined
}

/**
 * Registers the content types of the docs layer. It is OFF when the
 * app turns the standalone CMS off (`plutoGithub.enabled: false`). The default
 * `'auto'` and `true` both count as on. The module only checks the options
 * and copies them to the public runtime config. The client plugin
 * (`app/plugins/pluto-docs.ts`) and the Nitro plugin
 * (`server/plugins/pluto-docs.ts`) of the layer build the types from
 * that config. See the docs-setup skill.
 *
 * Zero config: with no `types`, the types come from the page collections that Nuxt Content
 * resolved (`collectionTypes`), after every module ran, and the render mode is `'build'` unless
 * the app sets it (the pages of a theme such as Docus call `queryCollection`, not the composables
 * of the layer). Core wraps a root with no `PlutoRoot` (the pluto-root module), so a theme root
 * such as the one of Docus needs nothing from this layer.
 */
export default defineNuxtModule<PlutoDocsOptions>({
  meta: { name: 'pluto-docs', configKey: 'plutoDocs' },
  defaults: { types: [] },
  setup(options, nuxt) {
    const logger = useLogger('pluto-docs')
    const { resolve } = createResolver(import.meta.url)
    const cms = (
      nuxt.options as { plutoGithub?: { enabled?: boolean | 'auto' } }
    ).plutoGithub
    const cmsEnabled = cms?.enabled !== false
    const fromCollections = (options.types ?? []).length === 0

    if (!cmsEnabled) {
      for (const error of resolvePlutoDocsOptions(options, { cmsEnabled })
        .errors) {
        logger.error(error)
      }
      return
    }

    if (!fromCollections) {
      apply(resolvePlutoDocsOptions(options, { cmsEnabled }), '')
      return
    }

    // The collections are known when Nuxt Content has run, so after every module.
    nuxt.hook('modules:done', () => {
      const collections = contentCollections(nuxt)
      if (!collections) {
        logger.warn(
          'No Nuxt Content collections found, so the docs layer has no content type. Set plutoDocs.types.'
        )
        return
      }
      const { types, skipped } = collectionTypes(collections)
      for (const line of skipped) {
        logger.info(`Collection ${line}: no content type.`)
      }
      apply(
        resolvePlutoDocsOptions(
          { ...options, types, render: options.render ?? 'build' },
          { cmsEnabled }
        ),
        ' (from the Nuxt Content collections)'
      )
    })

    function apply(resolved: PlutoDocsResolveResult, origin: string) {
      const { render, runtimeMaxAge, types, errors } = resolved
      for (const error of errors) {
        logger.error(error)
      }

      // The plugins read this key. It is absent when the layer is off.
      nuxt.options.runtimeConfig.public.plutoDocs = {
        types,
        render,
        runtimeMaxAge,
      }

      if (render === 'hybrid' || render === 'runtime') {
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
          `Docs layer on. Types${origin}: ${types.map((type) => type.name).join(', ') || 'none'}. Render: ${render}.`
        )
      }
    }
  },
})
