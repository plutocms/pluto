import type { Component, ComputedRef } from 'vue'
import type { PlutoContentType, PlutoFieldType } from './content'

/**
 * A kind of file of the media library: images, PDFs, 3D models (the 3D
 * add-on). The library, the tiles, the details and the picker use the first
 * kind whose `accept` matches the type of a file. See the media skill.
 */
export interface PlutoMediaKind extends PlutoEntry {
  /** MIME types or families: `['model/gltf-binary']`, `['image/*']`. */
  accept: string[]
  /** A translation key or literal: the name of the kind ("3D model"). */
  label: string
  icon: string
  /** A short badge on a tile ("3D", "PDF"). None for images. */
  badge?: string
  /** Shows a file of this kind in the details and the picker. Props: `media`. */
  viewer?: Component
  /**
   * Makes a static preview image of a file, in the browser (WebP, about 1024 px).
   * Core sends it with the upload, and "Make a preview" runs it on a stored file.
   * Returns `null` when it cannot.
   */
  createPreview?: (file: Blob) => Promise<Blob | null>
  /**
   * Checks a file before the upload, and returns a warning (a translation key or
   * literal) that does not stop the upload: for example a 3D model that links
   * textures it does not hold. `null` when all is well.
   */
  inspect?: (file: Blob) => Promise<string | null>
}

/**
 * A group of content types in the admin menus. A content type names its group
 * with `navGroup`. The sidebar shows the types of a group as one item with one
 * link per type, and the admin bar lists them in one "New" menu. Core declares
 * the group `pages`. See the extension-registry skill.
 */
export interface PlutoNavGroup extends PlutoEntry {
  /** A translation key or literal: the name of the group ("Pages"). */
  label: string
  icon?: string
}

export interface PlutoEntry {
  /** Unique inside this extension. Stored as `<extensionId>:<id>`. */
  id: string
  /** Lower comes first. Default 100. Core uses 0 for Home and 1000 for Settings. */
  order?: number
  /** Reactive visibility test. Called inside a computed. */
  enabled?: () => boolean
}

export interface PlutoNavChild {
  label: string
  to: string
  icon?: string
}

export interface PlutoNavItem extends PlutoEntry {
  label: string
  icon?: string
  /** Admin route path, for example '/admin/posts'. Plain string on purpose. */
  to?: string
  /**
   * More admin paths that belong to this item, for example '/admin/product' for
   * the edit pages of a product. The sidebar opens the item on these pages too.
   */
  match?: string[]
  children?: PlutoNavChild[]
  defaultOpen?: boolean
}

/** A navbar action that renders its own component. */
export interface PlutoNavbarComponentAction extends PlutoEntry {
  component: Component
}

/**
 * A navbar action that is a plain link. Core renders it with one look
 * (`PlutoNavbarButton`). `label` is key-or-literal. `to` can be a function,
 * for a target that depends on reactive state (for example the current page).
 */
export interface PlutoNavbarLinkAction extends PlutoEntry {
  label: string
  icon?: string
  to: string | (() => string)
  target?: string
}

export type PlutoNavbarAction =
  PlutoNavbarComponentAction | PlutoNavbarLinkAction

export interface PlutoAdminPage extends PlutoEntry {
  /** The route Nuxt already created from a file. This registry only adds metadata. */
  path: string
  title: string
  icon?: string
  /** Full id of a parent page (e.g. 'supabase-blog:posts'), for a breadcrumb trail. */
  parent?: string
}

export interface PlutoDashboardWidget extends PlutoEntry {
  component: Component
  title?: string
  /** Grid columns on large screens. 1 to 3. Default 1. */
  colSpan?: 1 | 2 | 3
}

export interface PlutoSettingsPanel extends PlutoEntry {
  title: string
  description?: string
  icon?: string
  component: Component
}

/**
 * A tab of the Settings section. The route is a file the layer ships at
 * `pages/admin/settings/<x>.vue`. This entry only adds the tab and the nav
 * link. Core registers General (`/admin/settings`, order 0).
 */
export interface PlutoSettingsPage extends PlutoEntry {
  /** Key-or-literal. */
  label: string
  icon?: string
  /** Admin route path, for example '/admin/settings/users'. */
  to: string
  /** Capability the user needs to see the tab. '*' means admin only. No capability: anyone in the admin. */
  capability?: string
}

/**
 * A section a layer adds to the Email settings page (`/admin/settings/email`),
 * below the core setup steps. For example, a backend layer adds a section
 * that explains how to send its own sign-in emails through the mail driver.
 */
export interface PlutoMailPanel extends PlutoEntry {
  title: string
  description?: string
  icon?: string
  component: Component
}

export interface PlutoSettingsDriver extends PlutoEntry {
  load: () => Promise<Record<string, string>>
  save: (patch: Record<string, string>) => Promise<void>
}

/**
 * Loads and saves the current user's admin language. One backend layer
 * registers this, the same way one layer registers a PlutoSettingsDriver.
 * `load` returns the stored locale code, or null when the user chose
 * Automatic (browser language). `save` stores a code, or null for Automatic.
 */
export interface PlutoLocaleDriver extends PlutoEntry {
  load: () => Promise<string | null>
  save: (locale: string | null) => Promise<void>
}

/**
 * A capability a layer defines. `key` is the real capability string, for
 * example 'posts:publish'. It is kept separate from `id` on purpose: the
 * registry rewrites `id` to '<extensionId>:<id>' (see registry-factory.ts),
 * which would corrupt a capability string if `id` were reused as the
 * capability itself. `id` identifies this registry entry; `key` identifies
 * the permission.
 */
export interface PlutoCapability extends PlutoEntry {
  /** Format: '<namespace>:<action>', lowercase, for example 'posts:publish'. */
  key: string
  label: string
  description?: string
}

/**
 * Loads the current user's capability list. One backend layer registers
 * this, the same way one layer registers a PlutoSettingsDriver. `load`
 * returns a flat list of capability key strings the user holds. The
 * single entry '*' means "every capability" (used by the built-in admin
 * role).
 */
export interface PlutoPermissionsDriver extends PlutoEntry {
  load: () => Promise<string[]>
}

/**
 * A content type a layer declares, wrapped for the registry. `type.name`
 * is the content type's real identity — see the doc comment on
 * `PlutoContentType.name` in `shared/types/content.ts` for why it is kept
 * separate from this entry's `id`.
 */
export interface PlutoContentTypeEntry extends PlutoEntry {
  type: PlutoContentType
}

/**
 * A component that renders one field type, or one named `widget`, in the
 * generic content form (a later wave). `fieldType` and `widget` are both
 * optional so an entry can match by either — see
 * `usePlutoContentFieldWidget` for the resolution order.
 */
export interface PlutoContentFieldWidget extends PlutoEntry {
  fieldType?: PlutoFieldType
  widget?: string
  component: Component
}

/** State passed to a `PlutoContentAction`'s `show` test and `onSelect` handler. */
export interface PlutoContentActionContext {
  type: PlutoContentType
  item: Record<string, unknown>
  editing: boolean
  saving: boolean
  save: () => Promise<void>
  remove: () => Promise<void>
}

/**
 * A button a layer adds to the generic content form (a later wave). Matched
 * against a content type the same way `PlutoContentFieldWidget` matches a
 * field: by exact name, or by `'*'` for every content type.
 */
export interface PlutoContentAction extends PlutoEntry {
  /** Content type `name`, or '*' for every content type. */
  contentType: string | '*'
  label: string
  icon?: string
  color?: string
  variant?: string
  /** Where the action renders. Default 'toolbar'. */
  placement?: 'toolbar' | 'aside'
  show?: (ctx: PlutoContentActionContext) => boolean
  onSelect: (ctx: PlutoContentActionContext) => void | Promise<void>
}

/**
 * A component a layer adds to the toolbar of the generic content form, before
 * the buttons (a status, an indicator). It renders inside the form, so it can
 * call `usePlutoContentForm()` to read the item and to run code after a save.
 * It gets no props. Matched against a content type like `PlutoContentAction`:
 * by exact name, or by `'*'` for every content type. Register it with
 * `defineAsyncComponent`, so it loads on demand.
 */
export interface PlutoContentToolbarItem extends PlutoEntry {
  /** Content type `name`, or '*' for every content type. */
  contentType: string | '*'
  component: Component
}

/** The signed-in user, as the admin shell needs it. Every field but `id` is optional. */
export interface PlutoAuthUser {
  id: string
  name?: string
  username?: string
  email?: string
  avatarUrl?: string
}

/**
 * A path that needs no sign-in. `signedIn` says what happens when a signed-in
 * user opens it: 'redirect' (default) sends the user to the admin home,
 * 'allow' shows the page.
 */
export interface PlutoAuthPublicPath {
  path: string
  signedIn?: 'redirect' | 'allow'
}

/** Props core passes to the driver's `signIn` component. */
export interface PlutoAuthSignInProps {
  /** A safe local path to open after sign-in. Core checks it with `safeRedirect`. */
  redirect: string
}

/**
 * The sign-in backend of the admin. One backend layer registers it, and the
 * last registered driver wins, like the other drivers.
 *
 * Hydration rule: `user()` and `loggedIn()` are getters that read reactive
 * state. `loggedIn()` must give the same answer on the server and in the
 * first client render. A backend with a cookie session that the server can read
 * (supabase) can answer on the server, so the admin bar renders in the server
 * HTML. A backend that learns the session in the browser (the standalone CMS)
 * must answer false on the server. Then the bar appears after hydration.
 * When `loggedIn` is missing, core uses `user() !== null`.
 */
export interface PlutoAuthDriver extends PlutoEntry {
  user: () => PlutoAuthUser | null
  loggedIn?: () => boolean
  /** Resolves when the first session check is done. Must never reject. */
  ready: () => Promise<void>
  /** Reads the session again. Optional. */
  refresh?: () => Promise<void>
  signOut: () => Promise<void>
  /** The sign-in form. Core renders it inside the login frame. Props: PlutoAuthSignInProps. */
  signIn: Component
  /** Key-or-literal. */
  signInTitle?: string
  /** Key-or-literal. */
  signInDescription?: string
  links?: {
    signUp?: string
    forgotPassword?: string
  }
  /** Paths that need no sign-in. '/admin/login' is always one. */
  publicPaths?: Array<string | PlutoAuthPublicPath>
  /**
   * A check that runs before the sign-in rule, on every `/admin` path, after
   * `ready()`. Return a local path to redirect there, or nothing to go on.
   * Supabase uses it to send a new install to the setup page first. A path the
   * check returns must handle itself: core does not run the check again on it
   * when it equals the current path. It must never reject.
   */
  guard?: (
    to: PlutoAuthGuardTarget
  ) => string | undefined | void | Promise<string | undefined | void>
}

/** The route facts that the driver's `guard` gets. */
export interface PlutoAuthGuardTarget {
  path: string
  fullPath: string
  query: Record<string, unknown>
}

/** An item a layer adds to the user menu of the admin navbar. */
export interface PlutoAccountMenuItem extends PlutoEntry {
  /** Key-or-literal. */
  label: string
  icon?: string
  to?: string
  target?: string
  kbds?: string[]
  onSelect?: () => void | Promise<void>
}

/** A banner shown below the admin navbar. */
export interface PlutoAdminBanner extends PlutoEntry {
  component: Component
}

/** Facts about the public site. A backend can give its own values. */
export interface PlutoSiteInfo extends PlutoEntry {
  name?: () => string | null | undefined
  url?: () => string | null | undefined
}

export interface PlutoExtension {
  /** Layer name. Use the package's $meta.name, e.g. 'supabase-blog'. */
  id: string
  navbarActions?: PlutoNavbarAction[]
  nav?: PlutoNavItem[]
  pages?: PlutoAdminPage[]
  dashboardWidgets?: PlutoDashboardWidget[]
  settingsPanels?: PlutoSettingsPanel[]
  settingsPages?: PlutoSettingsPage[]
  mailPanels?: PlutoMailPanel[]
  settingsDriver?: PlutoSettingsDriver
  localeDriver?: PlutoLocaleDriver
  capabilities?: PlutoCapability[]
  permissionsDriver?: PlutoPermissionsDriver
  authDriver?: PlutoAuthDriver
  accountMenu?: PlutoAccountMenuItem[]
  adminBanners?: PlutoAdminBanner[]
  site?: PlutoSiteInfo
  contentTypes?: PlutoContentTypeEntry[]
  contentFieldWidgets?: PlutoContentFieldWidget[]
  contentActions?: PlutoContentAction[]
  contentToolbarItems?: PlutoContentToolbarItem[]
  mediaKinds?: PlutoMediaKind[]
  navGroups?: PlutoNavGroup[]
}

/**
 * The shape `createOwnedRegistry` returns, one per registrable thing. Declared
 * again here, rather than imported from `app/composables/internal`, because
 * the shared TS project does not include `app/`. Structural typing keeps this
 * in sync with the real return type.
 */
export interface PlutoRegistryBucket<T extends PlutoEntry> {
  set: (owner: string, entries: T[]) => void
  remove: (owner: string) => void
  list: ComputedRef<T[]>
}

export interface PlutoRegistry {
  navbarActions: PlutoRegistryBucket<PlutoNavbarAction>
  nav: PlutoRegistryBucket<PlutoNavItem>
  pages: PlutoRegistryBucket<PlutoAdminPage>
  settingsPanels: PlutoRegistryBucket<PlutoSettingsPanel>
  settingsPages: PlutoRegistryBucket<PlutoSettingsPage>
  mailPanels: PlutoRegistryBucket<PlutoMailPanel>
  settingsDrivers: PlutoRegistryBucket<PlutoSettingsDriver>
  localeDrivers: PlutoRegistryBucket<PlutoLocaleDriver>
  dashboardWidgets: PlutoRegistryBucket<PlutoDashboardWidget>
  capabilities: PlutoRegistryBucket<PlutoCapability>
  permissionsDrivers: PlutoRegistryBucket<PlutoPermissionsDriver>
  authDrivers: PlutoRegistryBucket<PlutoAuthDriver>
  accountMenu: PlutoRegistryBucket<PlutoAccountMenuItem>
  adminBanners: PlutoRegistryBucket<PlutoAdminBanner>
  siteInfo: PlutoRegistryBucket<PlutoSiteInfo>
  contentTypes: PlutoRegistryBucket<PlutoContentTypeEntry>
  contentFieldWidgets: PlutoRegistryBucket<PlutoContentFieldWidget>
  contentActions: PlutoRegistryBucket<PlutoContentAction>
  contentToolbarItems: PlutoRegistryBucket<PlutoContentToolbarItem>
  mediaKinds: PlutoRegistryBucket<PlutoMediaKind>
  navGroups: PlutoRegistryBucket<PlutoNavGroup>
}
