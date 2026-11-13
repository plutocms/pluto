import type { PlutoContentType } from '../types/content'

/** Whether the type has one item. See `PlutoContentType.singleton`. */
export function isSingletonType(type: PlutoContentType | undefined): boolean {
  return Boolean(type?.singleton)
}

/** The id of the item of a singleton type in a file store: `singleton.id`, else the type name. */
export function singletonItemId(type: PlutoContentType): string {
  const option = type.singleton
  return (typeof option === 'object' && option.id) || type.name
}
