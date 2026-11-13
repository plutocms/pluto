// Nuxt loads `nuxt.config.ts` before any module runs: this file imports Node built-ins only.
import { existsSync } from 'node:fs'
import { isAbsolute, resolve } from 'node:path'
import process from 'node:process'

export interface PlutoLayerOptions {
  /** The folder with the Pluto checkouts. It wins over `PLUTO_LOCAL_ROOT`. */
  root?: string
}

/** The checkout of each Pluto layer under the root, by package name without the scope. */
export const PLUTO_LAYER_PATHS: Readonly<Record<string, string>> = {
  core: 'pluto/packages/core',
  supabase: 'supabase/packages/supabase',
  'supabase-shop': 'supabase/packages/supabase-shop',
  'supabase-blog': 'supabase/packages/supabase-blog',
  docs: 'pluto/packages/layers/docs',
  '3d': 'pluto/packages/layers/addons/3d',
  shop: 'pluto/packages/layers/addons/shop',
  seo: 'pluto/packages/layers/addons/seo',
  'syntax-lowlight': 'pluto/packages/layers/addons/syntax-lowlight',
}

const SCOPE = '@plutocms/'

function folderOf(name: string): string {
  return name.startsWith(SCOPE) ? name.slice(SCOPE.length) : name
}

/** `supabase-shop` becomes `PLUTO_SUPABASE_SHOP_PATH`. */
export function plutoLayerEnvName(name: string): string {
  return `PLUTO_${folderOf(name).toUpperCase().replaceAll('-', '_')}_PATH`
}

function checkoutOf(root: string, folder: string): string {
  return resolve(root, PLUTO_LAYER_PATHS[folder] ?? folder)
}

/**
 * Returns a Nuxt `extends` entry for a Pluto layer: the package name, so Nuxt uses the npm
 * package.
 *
 * Local mode is on when `PLUTO_LOCAL_ROOT` or `options.root` is set, unless `PLUTO_USE_LOCAL=false`.
 * The root is an absolute path, or a path relative to the current working directory. In local
 * mode the helper sets `PLUTO_<NAME>_PATH` for every known checkout under the root, so the layers
 * that extend other Pluto layers use the local copies too. An explicit `PLUTO_<NAME>_PATH` wins.
 *
 * @example
 * import { plutoLayer } from '@plutocms/core/layers'
 * export default defineNuxtConfig({ extends: [plutoLayer('@plutocms/core')] })
 * @see https://pluto.vulmix.dev/docs/contributing/workspace#the-plutolayer-helper
 */
export function plutoLayer(
  name: string,
  options: PlutoLayerOptions = {}
): string {
  const envName = plutoLayerEnvName(name)

  const rootValue = options.root || process.env.PLUTO_LOCAL_ROOT
  if (rootValue && process.env.PLUTO_USE_LOCAL !== 'false') {
    const root = isAbsolute(rootValue)
      ? rootValue
      : resolve(process.cwd(), rootValue)
    const folders = new Set([...Object.keys(PLUTO_LAYER_PATHS), folderOf(name)])
    for (const folder of folders) {
      const variable = plutoLayerEnvName(folder)
      const checkout = checkoutOf(root, folder)
      if (
        !process.env[variable] &&
        existsSync(resolve(checkout, 'nuxt.config.ts'))
      ) {
        process.env[variable] = checkout
      }
    }
  }

  return process.env[envName] || name
}
