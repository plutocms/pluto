import type { PlutoAuthDriver } from '../types/registry'

function isComponent(value: unknown): boolean {
  return typeof value === 'function' || (typeof value === 'object' && value !== null)
}

/**
 * Checks an auth driver. It gives one message for each problem, and an empty
 * list when the driver is valid. Core calls it in development only.
 */
export function validatePlutoAuthDriver(driver: Partial<PlutoAuthDriver> | null | undefined): string[] {
  if (!driver || typeof driver !== 'object') {
    return ['The auth driver is not an object.']
  }

  const problems: string[] = []
  for (const name of ['user', 'ready', 'signOut'] as const) {
    if (typeof driver[name] !== 'function') {
      problems.push(`"${name}" must be a function.`)
    }
  }
  for (const name of ['loggedIn', 'refresh', 'guard'] as const) {
    if (driver[name] !== undefined && typeof driver[name] !== 'function') {
      problems.push(`"${name}" must be a function when set.`)
    }
  }
  if (!isComponent(driver.signIn)) {
    problems.push('"signIn" must be a component.')
  }
  for (const name of ['signInTitle', 'signInDescription'] as const) {
    if (driver[name] !== undefined && typeof driver[name] !== 'string') {
      problems.push(`"${name}" must be a string when set.`)
    }
  }
  for (const name of ['signUp', 'forgotPassword'] as const) {
    const link = driver.links?.[name]
    if (link !== undefined && typeof link !== 'string') {
      problems.push(`"links.${name}" must be a string when set.`)
    }
  }

  if (driver.publicPaths !== undefined && !Array.isArray(driver.publicPaths)) {
    problems.push('"publicPaths" must be an array when set.')
  } else {
    for (const entry of driver.publicPaths ?? []) {
      const path = typeof entry === 'string' ? entry : entry?.path
      if (typeof path !== 'string' || !path.startsWith('/')) {
        problems.push(`A public path must start with "/": ${JSON.stringify(path)}.`)
      }
      if (typeof entry === 'object' && entry.signedIn !== undefined && entry.signedIn !== 'redirect' && entry.signedIn !== 'allow') {
        problems.push(`"signedIn" of "${path}" must be "redirect" or "allow".`)
      }
    }
  }

  return problems
}
