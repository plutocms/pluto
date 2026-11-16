export interface ElementorElement {
  id?: string
  elType: string
  isInner?: boolean
  widgetType?: string
  settings?: Record<string, unknown>
  elements?: ElementorElement[]
}

export type PropValue = string | number | boolean

export interface BlockNode {
  name: string
  props: Record<string, PropValue | undefined>
  children?: BlockNode[]
  text?: string
}

export const RAW_HTML = '#html'

export interface WxrCategory {
  domain: string
  slug: string
  name: string
}

export interface WxrTerm {
  id: number
  taxonomy: string
  slug: string
  name: string
}

export interface WxrPost {
  id: number
  type: string
  status: string
  title: string
  slug: string
  link: string
  parent: number
  date: string
  content: string
  excerpt: string
  attachmentUrl: string
  menuOrder: number
  categories: WxrCategory[]
  meta: Record<string, string>
}

export interface Wxr {
  title: string
  link: string
  baseUrl: string
  frontPageId?: number
  terms: WxrTerm[]
  posts: WxrPost[]
}

export interface ThemeColors {
  primary?: string
  secondary?: string
  text?: string
  accent?: string
  background?: string
}

export interface BlocksTheme {
  colors: ThemeColors
  fonts: {
    heading?: string
    body?: string
  }
}

export interface Kit {
  theme: BlocksTheme
  globalColors: Record<string, string>
  headingFont?: string
  bodyFont?: string
  fonts: FontUse[]
}

export interface FontUse {
  family: string
  weights: string[]
}

export interface PageReport {
  placeholders: string[]
  unknownWidgets: Record<string, number>
  shortcodes: string[]
  roundings: string[]
  droppedResponsive: number
  ignoredStyles: Record<string, number>
  unmappedIcons: string[]
  addonPrefixes: string[]
  missingAlt: number
  rawHtml: string[]
  notes: string[]
}

export interface Attachment {
  url: string
  alt: string
}

export interface MenuLink {
  label: string
  link?: string
  target?: string
  children: MenuLink[]
}

export interface SiteContext {
  title: string
  logo?: string
  year: number
  menus: Map<string, MenuLink[]>
}

export interface ConvertContext {
  kit: Kit
  report: PageReport
  images: Map<string, string>
  attachments: Map<number, Attachment>
  baseUrl: string
  fonts: Map<string, Set<string>>
  site?: SiteContext
}

export function emptyReport(): PageReport {
  return {
    placeholders: [],
    unknownWidgets: {},
    shortcodes: [],
    roundings: [],
    droppedResponsive: 0,
    ignoredStyles: {},
    unmappedIcons: [],
    addonPrefixes: [],
    missingAlt: 0,
    rawHtml: [],
    notes: [],
  }
}
