import type {
  PlutoContentType,
  PlutoContentTypeExtension,
} from '../types/content'
import { defineContentType } from './content'
import { withStandardFields } from './content-standard'

/**
 * Runs content type extensions on a type, in the order given, and returns the extended type. An
 * extension that changes nothing returns the same object, so a type with no change keeps its
 * identity. In dev, an extended type goes through the same checks as `defineContentType`. Then
 * the fields of the standard options (`excerpt`, `cover`) are added when the type has no such
 * field (`withStandardFields`). The server and the client registry both read types through here.
 */
export function applyContentTypeExtensions(
  type: PlutoContentType,
  extensions: PlutoContentTypeExtension[]
): PlutoContentType {
  const extended = withStandardFields(
    extensions.reduce((current, extension) => extension.extend(current), type)
  )
  return extended === type ? type : defineContentType(extended)
}
