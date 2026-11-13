import type {
  PlutoContentType,
  PlutoContentTypeExtension,
} from '../types/content'
import { defineContentType } from './content'
import { withStandardFields } from './content-standard'

export function applyContentTypeExtensions(
  type: PlutoContentType,
  extensions: PlutoContentTypeExtension[]
): PlutoContentType {
  const extended = withStandardFields(
    extensions.reduce((current, extension) => extension.extend(current), type)
  )
  return extended === type ? type : defineContentType(extended)
}
