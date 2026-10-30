// Pure rules of the admin shell: paths, redirects, the route guard, and the
// navbar visibility. This file lives under `internal/` so it stays out of
// auto-import and runs under plain Vitest. It imports no Nuxt API.
import type {
  PlutoAuthPublicPath,
  PlutoAuthUser,
} from '../../../shared/types/registry'

export const ADMIN_LOGIN_PATH = '/admin/login'
export const ADMIN_HOME_PATH = '/admin/home'
export const ADMIN_NO_ACCESS_PATH = '/admin/no-access'

const FAKE_ORIGIN = 'http://pluto.invalid'

/** True for `/admin` and every path below it. */
export function isAdminPath(path: string): boolean {
  return path === '/admin' || path.startsWith('/admin/')
}

function trimSlash(path: string): string {
  return path.length > 1 && path.endsWith('/') ? path.slice(0, -1) : path
}

/**
 * Turns the driver's `publicPaths` into one list of objects. The login path is
 * always there, and a signed-in user is always sent away from it.
 */
export function normalizePublicPaths(
  paths: Array<string | PlutoAuthPublicPath> | undefined
): PlutoAuthPublicPath[] {
  const result: PlutoAuthPublicPath[] = [
    { path: ADMIN_LOGIN_PATH, signedIn: 'redirect' },
  ]
  for (const entry of paths ?? []) {
    const item = typeof entry === 'string' ? { path: entry } : entry
    const path = trimSlash(item.path)
    if (!path || result.some((known) => known.path === path)) {
      continue
    }
    result.push({ path, signedIn: item.signedIn ?? 'redirect' })
  }
  return result
}

/** Finds the public path entry that covers `path`: an exact match, or a child path. */
export function matchPublicPath(
  path: string,
  publicPaths: PlutoAuthPublicPath[]
): PlutoAuthPublicPath | undefined {
  const clean = trimSlash(path)
  return publicPaths.find(
    (entry) => clean === entry.path || clean.startsWith(`${entry.path}/`)
  )
}

function hasControlCharacter(text: string): boolean {
  return [...text].some((char) => {
    const code = char.charCodeAt(0)
    return code < 32 || code === 127
  })
}

/**
 * Checks a post-login redirect target. Only a path on this site is valid: one
 * leading slash, no backslash, no control character, no other origin. It gives
 * '' when the value is not safe. The rule is the same as `safeRedirect` in the
 * CMS server utils.
 */
export function safeRedirect(value: unknown): string {
  if (typeof value !== 'string' || value === '' || value.length > 2048) {
    return ''
  }
  if (
    !value.startsWith('/') ||
    value.startsWith('//') ||
    value.includes('\\')
  ) {
    return ''
  }
  if (hasControlCharacter(value)) {
    return ''
  }
  try {
    if (new URL(value, FAKE_ORIGIN).origin !== FAKE_ORIGIN) {
      return ''
    }
  } catch {
    return ''
  }
  return value
}

export type GuardDecision =
  | {
      action: 'allow'
    }
  | {
      action: 'redirect'
      to: string
    }

export interface GuardInput {
  path: string
  fullPath: string
  query: Record<string, unknown>
  loggedIn: boolean
  publicPaths: PlutoAuthPublicPath[]
}

function firstString(value: unknown): unknown {
  return Array.isArray(value) ? value[0] : value
}

/**
 * Decides what the route guard does. It never touches a path outside `/admin`.
 * A signed-out user on a private admin path goes to the login page, with the
 * wanted path in `redirect`. A signed-in user on a public auth path goes to the
 * `redirect` target, or to the admin home, unless that path has `signedIn: 'allow'`.
 */
export function guardDecision(input: GuardInput): GuardDecision {
  const { path, fullPath, query, loggedIn, publicPaths } = input
  if (!isAdminPath(path)) {
    return { action: 'allow' }
  }

  const publicEntry = matchPublicPath(path, publicPaths)
  if (publicEntry) {
    if (!loggedIn || publicEntry.signedIn === 'allow') {
      return { action: 'allow' }
    }
    const target = safeRedirect(firstString(query.redirect))
    // A target that is a public auth path which also redirects would loop.
    const targetEntry = target
      ? matchPublicPath(new URL(target, FAKE_ORIGIN).pathname, publicPaths)
      : undefined
    const loops = targetEntry !== undefined && targetEntry.signedIn !== 'allow'
    return {
      action: 'redirect',
      to: target && !loops ? target : ADMIN_HOME_PATH,
    }
  }

  if (loggedIn) {
    return { action: 'allow' }
  }
  const wanted = safeRedirect(fullPath)
  return {
    action: 'redirect',
    to: wanted
      ? `${ADMIN_LOGIN_PATH}?redirect=${encodeURIComponent(wanted)}`
      : ADMIN_LOGIN_PATH,
  }
}

/**
 * True for a staff user: a user who holds at least one capability. With no
 * permissions driver every signed-in user counts as staff, like `can()` that
 * fails open. The server RLS uses the same meaning.
 */
export function isStaff(
  hasDriver: boolean,
  granted: readonly string[]
): boolean {
  return !hasDriver || granted.length > 0
}

export interface StaffInput {
  path: string
  fullPath: string
  query: Record<string, unknown>
  publicPaths: PlutoAuthPublicPath[]
  /** A permissions driver is registered. */
  hasDriver: boolean
  /** The capabilities of the user. Ignored when `loadFailed` is true. */
  granted: readonly string[]
  /** The capabilities failed to load. */
  loadFailed: boolean
}

/**
 * Decides the staff step of the route guard. Run it after `guardDecision`
 * allowed a signed-in user. It never touches a path outside `/admin`, and
 * never checks a public auth path of the driver.
 *
 * - Staff on a private path: allow. Staff on the no-access page: go to the
 *   checked `redirect` target, or to the admin home.
 * - Not staff, or the load failed, on a private path: go to the no-access page.
 *   The wanted path stays in `redirect`, and a failed load adds `reason=error`.
 * - On the no-access page, a user who is not staff stays. This keeps the guard
 *   free of a redirect loop.
 */
export function staffDecision(input: StaffInput): GuardDecision {
  const { path, fullPath, query, publicPaths, hasDriver, granted, loadFailed } =
    input
  if (!isAdminPath(path) || matchPublicPath(path, publicPaths)) {
    return { action: 'allow' }
  }

  const onNoAccess = trimSlash(path) === ADMIN_NO_ACCESS_PATH
  const staff = !loadFailed && isStaff(hasDriver, granted)

  if (staff) {
    if (!onNoAccess) {
      return { action: 'allow' }
    }
    const target = safeRedirect(firstString(query.redirect))
    const targetPath = target
      ? trimSlash(new URL(target, FAKE_ORIGIN).pathname)
      : ''
    return {
      action: 'redirect',
      to:
        target && targetPath !== ADMIN_NO_ACCESS_PATH
          ? target
          : ADMIN_HOME_PATH,
    }
  }

  if (onNoAccess) {
    return { action: 'allow' }
  }
  const params: string[] = []
  if (loadFailed) {
    params.push('reason=error')
  }
  const wanted = safeRedirect(fullPath)
  if (wanted) {
    params.push(`redirect=${encodeURIComponent(wanted)}`)
  }
  return {
    action: 'redirect',
    to: params.length
      ? `${ADMIN_NO_ACCESS_PATH}?${params.join('&')}`
      : ADMIN_NO_ACCESS_PATH,
  }
}

export interface NavbarVisibleInput {
  path: string
  loggedIn: boolean
  /** The user holds at least one capability, or '*'. */
  isStaff: boolean
  /** The capabilities finished loading in the browser. */
  capabilitiesKnown: boolean
  publicPaths: PlutoAuthPublicPath[]
  /** The route hides the bar: the page meta `plutoAdminBar: false`, or the preview path. */
  hiddenByRoute?: boolean
  /**
   * Public pages only: the hint cookie says that this browser showed the bar to
   * staff before, and the session is not known yet. The server renders the bar
   * from it. See `ADMIN_BAR_HINT_COOKIE`.
   */
  hint?: boolean
}

/**
 * The cookie that lets the server render the admin bar on a public page. The
 * client sets it when the bar shows for a confirmed staff user, and removes it
 * when the session ends or the user is no staff. It holds no user data and
 * gives no access: it only decides if the empty bar frame is in the server HTML.
 */
export const ADMIN_BAR_HINT_COOKIE = 'pluto-admin-bar'

/**
 * Whether the admin bar shows. On `/admin/**` it shows for a signed-in user,
 * except on the public auth paths, and except for a user who is known to be
 * no staff (the no-access page). On a public page it shows for staff only,
 * after the capabilities are known. Before that, the hint decides, so the
 * server HTML has the bar for a browser that showed it before, and a shop
 * customer never sees it.
 *
 * A route can opt out with the page meta `plutoAdminBar: false`, and the preview
 * path (`isPlutoPreviewPath`) always opts out. `usePlutoAdminBar` reads both and
 * passes `hiddenByRoute`. This file stays free of Nuxt imports.
 */
export function navbarVisible(input: NavbarVisibleInput): boolean {
  const {
    path,
    loggedIn,
    isStaff: isStaffUser,
    capabilitiesKnown,
    publicPaths,
    hiddenByRoute,
    hint,
  } = input
  if (hiddenByRoute) {
    return false
  }
  if (!isAdminPath(path) && !capabilitiesKnown && hint) {
    return true
  }
  if (!loggedIn) {
    return false
  }
  if (isAdminPath(path)) {
    // A user who is known to be no staff gets the no-access page, with no bar.
    if (capabilitiesKnown && !isStaffUser) {
      return false
    }
    return !matchPublicPath(path, publicPaths)
  }
  return capabilitiesKnown && isStaffUser
}

/** The name shown for a user: name, else username, else the fallback. */
export function displayName(
  user: PlutoAuthUser | null | undefined,
  fallback: string
): string {
  return user?.name?.trim() || user?.username?.trim() || fallback
}

/** The first word of the display name. It shows next to the avatar. */
export function shortName(
  user: PlutoAuthUser | null | undefined,
  fallback: string
): string {
  const name = displayName(user, fallback)
  return name.split(/\s+/)[0] || name
}

/**
 * The site name for the tab title. Take the first value that is set: the name
 * of the site info, the `websiteName` runtime config (unless it is the
 * default 'Untitled'), then the fallback.
 */
export function resolveSiteName(
  infoName: string | undefined,
  websiteName: string | undefined,
  fallback: string
): string {
  if (infoName) {
    return infoName
  }
  if (websiteName && websiteName !== 'Untitled') {
    return websiteName
  }
  return fallback
}
