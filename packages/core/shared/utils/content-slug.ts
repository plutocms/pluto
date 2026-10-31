/** The longest slug `slugifyTitle` returns. */
export const SLUG_MAX_LENGTH = 100

/**
 * Makes a slug from a title. It drops accents, so "Pão de Mel" becomes
 * "pao-de-mel". The result is lowercase ASCII, with single dashes. It can
 * be an empty string.
 *
 * The form and the GitHub CMS both use this function.
 */
export function slugifyTitle(value: string): string {
  return value
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, SLUG_MAX_LENGTH)
    .replace(/-+$/, '')
}
