import type { PlutoContentType } from '../../../../shared/types/content'
import { isLiveItem } from '../../../../shared/utils/content-status'

export function isPostTypeOn(
  config:
    | {
        postType?: boolean
      }
    | undefined
): boolean {
  return config?.postType !== false
}

export function showPublicRepoWarning(
  repoPrivate: boolean | undefined,
  types: readonly Pick<PlutoContentType, 'status'>[]
): boolean {
  return repoPrivate === false && types.some((type) => Boolean(type.status))
}

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

export function isPublicItem(
  type: Pick<PlutoContentType, 'status'> | undefined,
  item: Record<string, unknown>
): boolean {
  return isLiveItem(type, item)
}
