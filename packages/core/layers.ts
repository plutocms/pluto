/**
 * The local layers helper. An app imports it in `nuxt.config.ts`:
 *
 *   import { plutoLayer } from '@plutocms/core/layers'
 *
 * Nuxt loads `nuxt.config.ts` before any module runs, so this file has no
 * Nuxt runtime import. It uses Node built-ins only. See the local-layers skill.
 */
import { existsSync } from 'node:fs'
import { isAbsolute, resolve } from 'node:path'
import process from 'node:process'

export interface PlutoLayerOptions {
  /** Pass `install: true` to Nuxt, so it installs the layer dependencies. Default `true`. */
  install?: boolean
  /** The folder with the Pluto checkouts. It wins over `PLUTO_LOCAL_ROOT`. */
  root?: string
}

export interface PlutoLayerEntryOptions {
  install: boolean
}

export type PlutoLayerEntry = [source: string, options: PlutoLayerEntryOptions]

/**
 * The checkout of each Pluto layer under the root. The key is the package name
 * without the scope. A package of a monorepo is in a folder of its repo.
 */
export const PLUTO_LAYER_PATHS: Readonly<Record<string, string>> = {
  core: 'pluto/packages/core',
  supabase: 'supabase',
  'supabase-shop': 'supabase-shop',
  'supabase-blog': 'supabase-blog',
  docs: 'pluto/packages/layers/docs',
  '3d': 'pluto/packages/layers/addons/3d',
}

const SCOPE = '@plutocms/'

/** `@plutocms/supabase-shop` becomes `supabase-shop`. */
function folderOf(name: string): string {
  return name.startsWith(SCOPE) ? name.slice(SCOPE.length) : name
}

/** `supabase-shop` becomes `PLUTO_SUPABASE_SHOP_PATH`. */
export function plutoLayerEnvName(name: string): string {
  return `PLUTO_${folderOf(name).toUpperCase().replaceAll('-', '_')}_PATH`
}

/** The checkout of a layer under the root. A layer that is not in the map has a folder of its name. */
function checkoutOf(root: string, folder: string): string {
  return resolve(root, PLUTO_LAYER_PATHS[folder] ?? folder)
}

/**
 * Returns a Nuxt `extends` entry for a Pluto layer.
 *
 * Default: the package name, so Nuxt uses the npm package.
 *
 * Local mode is on when `PLUTO_LOCAL_ROOT` is set (or `options.root` is set),
 * unless `PLUTO_USE_LOCAL=false`. The root is a path, absolute or relative to
 * the current working directory. In local mode the helper sets
 * `PLUTO_<NAME>_PATH` for every known checkout under the root, so the layers
 * that extend other Pluto layers use the local copies too. An explicit
 * `PLUTO_<NAME>_PATH` always wins.
 */
export function plutoLayer(
  name: string,
  options: PlutoLayerOptions = {}
): PlutoLayerEntry {
  const install = options.install ?? true
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

  return [process.env[envName] || name, { install }]
}
