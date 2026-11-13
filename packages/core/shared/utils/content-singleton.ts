import type { PlutoContentType } from '../types/content'

export function isSingletonType(type: PlutoContentType | undefined): boolean {
  return Boolean(type?.singleton)
}

export function singletonItemId(type: PlutoContentType): string {
  const option = type.singleton
  return (typeof option === 'object' && option.id) || type.name
}
