export interface RootComponentInfo {
  usesPlutoRoot: boolean
  hasUApp: boolean
}

function hasTag(text: string, pascal: string, kebab: string): boolean {
  return new RegExp(`<(?:${pascal}|${kebab})(?=[\\s>/])`).test(text)
}

export function inspectRootComponent(text: string): RootComponentInfo {
  const template = text.replace(/<!--[\s\S]*?-->/g, '')
  return {
    usesPlutoRoot: hasTag(template, 'PlutoRoot', 'pluto-root'),
    hasUApp: hasTag(template, 'UApp', 'u-app'),
  }
}

export type PlutoRootSiteApp = 'auto' | boolean

export function siteHasOwnApp(
  info: RootComponentInfo,
  siteApp: PlutoRootSiteApp | undefined
): boolean {
  return typeof siteApp === 'boolean' ? siteApp : info.hasUApp
}
