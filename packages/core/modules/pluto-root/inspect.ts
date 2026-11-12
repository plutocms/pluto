// Pure helpers of the pluto-root module: what the root component of the app (its `app.vue`, or the
// one of a theme layer) already does. No Nuxt import, so plain Vitest tests them.

export interface RootComponentInfo {
  /** The root renders `PlutoRoot` itself: Pluto leaves it as it is. */
  usesPlutoRoot: boolean
  /** The root renders its own `UApp` (a theme such as Docus): Pluto adds no second one. */
  hasUApp: boolean
}

/** Whether the text of a component has a tag of that name (`<UApp>`, `<UApp :locale`, `<u-app`). */
function hasTag(text: string, pascal: string, kebab: string): boolean {
  return new RegExp(`<(?:${pascal}|${kebab})(?=[\\s>/])`).test(text)
}

/** What the text of a root component (a `.vue` file) renders. */
export function inspectRootComponent(text: string): RootComponentInfo {
  const template = text.replace(/<!--[\s\S]*?-->/g, '')
  return {
    usesPlutoRoot: hasTag(template, 'PlutoRoot', 'pluto-root'),
    hasUApp: hasTag(template, 'UApp', 'u-app'),
  }
}

/** `'auto'` reads the root; `true` or `false` says whether the root has its own `UApp`. */
export type PlutoRootSiteApp = 'auto' | boolean

/** Whether the public page gets a `UApp` of Pluto around the site root. */
export function siteHasOwnApp(
  info: RootComponentInfo,
  siteApp: PlutoRootSiteApp | undefined
): boolean {
  return typeof siteApp === 'boolean' ? siteApp : info.hasUApp
}
