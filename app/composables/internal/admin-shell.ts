// Pure rules of the admin shell: paths, redirects, the route guard, and the
// navbar visibility. This file lives under `internal/` so it stays out of
// auto-import and runs under plain Vitest. It imports no Nuxt API.
import type { PlutoAuthPublicPath, PlutoAuthUser } from '../../../shared/types/registry'

export const ADMIN_LOGIN_PATH = '/admin/login'
export const ADMIN_HOME_PATH = '/admin/home'

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
  const result: PlutoAuthPublicPath[] = [{ path: ADMIN_LOGIN_PATH, signedIn: 'redirect' }]
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
  return publicPaths.find((entry) => clean === entry.path || clean.startsWith(`${entry.path}/`))
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
  if (!value.startsWith('/') || value.startsWith('//') || value.includes('\\')) {
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

export type GuardDecision = {
 action: 'allow'
} | {
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
    const targetEntry = target ? matchPublicPath(new URL(target, FAKE_ORIGIN).pathname, publicPaths) : undefined
    const loops = targetEntry !== undefined && targetEntry.signedIn !== 'allow'
    return { action: 'redirect', to: target && !loops ? target : ADMIN_HOME_PATH }
  }

  if (loggedIn) {
    return { action: 'allow' }
  }
  const wanted = safeRedirect(fullPath)
  return {
    action: 'redirect',
    to: wanted ? `${ADMIN_LOGIN_PATH}?redirect=${encodeURIComponent(wanted)}` : ADMIN_LOGIN_PATH,
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
}

/**
 * Whether the admin bar shows. On `/admin/**` it shows for a signed-in user,
 * except on the public auth paths. On a public page it shows for staff only,
 * and only after the capabilities are known. This keeps a shop customer from
 * seeing the bar, even for a moment, and keeps the server HTML free of it.
 */
export function navbarVisible(input: NavbarVisibleInput): boolean {
  const { path, loggedIn, isStaff, capabilitiesKnown, publicPaths } = input
  if (!loggedIn) {
    return false
  }
  if (isAdminPath(path)) {
    return !matchPublicPath(path, publicPaths)
  }
  return capabilitiesKnown && isStaff
}

/** The name shown for a user: name, else username, else the fallback. */
export function displayName(user: PlutoAuthUser | null | undefined, fallback: string): string {
  return user?.name?.trim() || user?.username?.trim() || fallback
}

/** The first word of the display name. It shows next to the avatar. */
export function shortName(user: PlutoAuthUser | null | undefined, fallback: string): string {
  const name = displayName(user, fallback)
  return name.split(/\s+/)[0] || name
}
