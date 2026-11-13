// No Nuxt auto-imports here: plain Vitest imports this file.
import type {
  PlutoAuthPublicPath,
  PlutoAuthUser,
} from '../../../shared/types/registry'

export const ADMIN_LOGIN_PATH = '/admin/login'
export const ADMIN_HOME_PATH = '/admin/home'
export const ADMIN_NO_ACCESS_PATH = '/admin/no-access'
export const ADMIN_NOT_CONFIGURED_PATH = '/admin/not-configured'

const FAKE_ORIGIN = 'http://pluto.invalid'

export function isAdminPath(path: string): boolean {
  return path === '/admin' || path.startsWith('/admin/')
}

function trimSlash(path: string): string {
  return path.length > 1 && path.endsWith('/') ? path.slice(0, -1) : path
}

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

export interface DriverInput {
  path: string
  hasDriver: boolean
  dev: boolean
}

export function driverDecision(input: DriverInput): GuardDecision | undefined {
  const { path, hasDriver, dev } = input
  if (!isAdminPath(path)) {
    return { action: 'allow' }
  }
  const onPage = trimSlash(path) === ADMIN_NOT_CONFIGURED_PATH
  if (hasDriver) {
    return onPage ? { action: 'redirect', to: ADMIN_HOME_PATH } : undefined
  }
  if (dev || onPage) {
    return { action: 'allow' }
  }
  return { action: 'redirect', to: ADMIN_NOT_CONFIGURED_PATH }
}

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
  hasDriver: boolean
  granted: readonly string[]
  loadFailed: boolean
}

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
  isStaff: boolean
  capabilitiesKnown: boolean
  publicPaths: PlutoAuthPublicPath[]
  hiddenByRoute?: boolean
  hint?: boolean
}

export const ADMIN_BAR_HINT_COOKIE = 'pluto-admin-bar'

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
    if (capabilitiesKnown && !isStaffUser) {
      return false
    }
    return !matchPublicPath(path, publicPaths)
  }
  return capabilitiesKnown && isStaffUser
}

export function displayName(
  user: PlutoAuthUser | null | undefined,
  fallback: string
): string {
  return user?.name?.trim() || user?.username?.trim() || fallback
}

export function shortName(
  user: PlutoAuthUser | null | undefined,
  fallback: string
): string {
  const name = displayName(user, fallback)
  return name.split(/\s+/)[0] || name
}

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
