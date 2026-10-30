import type { PlutoContentType } from '../types/content'
import { contentIdPath } from './content-id'

/** The admin list path of a type: `basePath`, else `/admin/content/<name>`. */
export function contentTypeBasePath(type: PlutoContentType): string {
  return type.basePath ?? `/admin/content/${type.name}`
}

/** The admin form that creates an item: `newPath`, else `<basePath>/new`. */
export function contentTypeNewPath(type: PlutoContentType): string {
  return type.newPath ?? `${contentTypeBasePath(type)}/new`
}

/** The admin form of an item: `editPath(id)`, else `<basePath>/<id>` (each segment encoded). */
export function contentTypeEditPath(
  type: PlutoContentType,
  id: string | number
): string {
  return (
    type.editPath?.(id) ?? `${contentTypeBasePath(type)}/${contentIdPath(id)}`
  )
}

/** The admin bar buttons that a type asks for. `true` gives both. Unset gives none. */
export function contentTypeAdminBar(type: PlutoContentType): {
  new: boolean
  edit: boolean
} {
  const option = type.adminBar
  if (option === true) {
    return { new: true, edit: true }
  }
  if (!option) {
    return { new: false, edit: false }
  }
  return { new: option.new === true, edit: option.edit === true }
}
