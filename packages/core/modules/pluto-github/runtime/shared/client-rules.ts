import type { PlutoContentType } from '../../../../shared/types/content'

/**
 * Whether the client registers the built-in post type. The module copies the
 * `postType` option to the public runtime config. A missing value counts as on,
 * like the option default.
 */
export function isPostTypeOn(
  config:
    | {
        postType?: boolean
      }
    | undefined
): boolean {
  return config?.postType !== false
}

/**
 * Whether the dashboard shows the public-repo warning. A draft is a file in
 * the repo, so a public repo exposes drafts. A type with no status has no
 * drafts. So the warning shows only for a public repo (`private === false`)
 * and at least one registered type with a status.
 */
export function showPublicRepoWarning(
  repoPrivate: boolean | undefined,
  types: readonly Pick<PlutoContentType, 'status'>[]
): boolean {
  return repoPrivate === false && types.some((type) => Boolean(type.status))
}

/**
 * Whether the edit form shows the build status. A save must start a deploy
 * (`commit.skipDeploy` is false), and the content must be in GitHub: the `fs`
 * store has no builds. The module copies both options to the public runtime config.
 */
export function showBuildStatus(
  config:
    | {
        storage?: string
        skipDeploy?: boolean
      }
    | undefined
): boolean {
  return config?.storage === 'github' && config.skipDeploy === false
}

/**
 * Whether an item is on the public site: a type with no status, or an item with the published
 * value. A missing status counts as the default. The edit form hides the build status for a draft
 * that was never public in the page: its saves skip the deploy.
 */
export function isPublicItem(
  type: Pick<PlutoContentType, 'status'> | undefined,
  item: Record<string, unknown>
): boolean {
  if (!type?.status) {
    return true
  }
  const value = item[type.status.column ?? 'status'] ?? type.status.default
  return value === (type.status.publishedValue || 'published')
}
