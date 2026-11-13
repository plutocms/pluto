import type { PlutoContentType } from '../types/content'
import { contentIdPath } from './content-id'

export function contentTypeBasePath(type: PlutoContentType): string {
  return type.basePath ?? `/admin/content/${type.name}`
}

/**
 * The admin form that creates an item: `newPath`, else `<basePath>/new`. A singleton type has one
 * page for its item: `basePath`.
 */
export function contentTypeNewPath(type: PlutoContentType): string {
  if (type.singleton) {
    return contentTypeBasePath(type)
  }
  return type.newPath ?? `${contentTypeBasePath(type)}/new`
}

/**
 * The admin form of an item: `editPath(id)`, else `<basePath>/<id>` (each segment encoded). A
 * singleton type: `basePath`.
 */
export function contentTypeEditPath(
  type: PlutoContentType,
  id: string | number
): string {
  if (type.singleton) {
    return contentTypeBasePath(type)
  }
  return (
    type.editPath?.(id) ?? `${contentTypeBasePath(type)}/${contentIdPath(id)}`
  )
}

export function contentTypeAdminBar(type: PlutoContentType): {
  new: boolean
  edit: boolean
} {
  const option = type.adminBar
  const single = Boolean(type.singleton)
  if (option === true) {
    return { new: !single, edit: true }
  }
  if (!option) {
    return { new: false, edit: false }
  }
  return { new: option.new === true && !single, edit: option.edit === true }
}
