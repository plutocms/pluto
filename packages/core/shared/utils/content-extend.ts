import type {
  PlutoContentType,
  PlutoContentTypeExtension,
} from '../types/content'
import { defineContentType } from './content'

/**
 * Runs content type extensions on a type, in the order given, and returns the extended type. An
 * extension that changes nothing returns the same object, so a type with no change keeps its
 * identity. In dev, an extended type goes through the same checks as `defineContentType`.
 */
export function applyContentTypeExtensions(
  type: PlutoContentType,
  extensions: PlutoContentTypeExtension[]
): PlutoContentType {
  const extended = extensions.reduce(
    (current, extension) => extension.extend(current),
    type
  )
  return extended === type ? type : defineContentType(extended)
}
