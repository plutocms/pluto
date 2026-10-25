import type { PlutoContentType } from '../../../../shared/types/content'

/**
 * Whether the client registers the built-in post type. The module copies the
 * `postType` option to the public runtime config. A missing value counts as on,
 * like the option default.
 */
export function isPostTypeOn(config: {
 postType?: boolean
} | undefined): boolean {
  return config?.postType !== false
}

/**
 * Whether the dashboard shows the public-repo warning. A draft is a file in
 * the repo, so a public repo exposes drafts. A type with no status has no
 * drafts. So the warning shows only for a public repo (`private === false`)
 * and at least one registered type with a status.
 */
export function showPublicRepoWarning(repoPrivate: boolean | undefined, types: readonly Pick<PlutoContentType, 'status'>[]): boolean {
  return repoPrivate === false && types.some((type) => Boolean(type.status))
}
