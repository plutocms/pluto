import type {
  PlutoContentItem,
  PlutoContentType,
  PlutoField,
} from '../types/content'
import { markdownToPlainText } from '../markdown/render'

/**
 * The standard options of a content type: `excerpt` and `cover`. Any type can turn them on. Core
 * adds the field when the type does not declare it, the public API gives `excerpt` (with a
 * fallback from the body) and `cover`, the admin list shows the cover, and the SEO of a site uses
 * both. See the content-model skill ("Excerpt and cover image"). Pure.
 */

/** The field names of the standard options of a type. A missing key: the option is off. */
export function standardFieldNames(
  type: Pick<PlutoContentType, 'excerpt' | 'cover'> | undefined
): { excerpt?: string; cover?: string } {
  const names: { excerpt?: string; cover?: string } = {}
  if (type?.excerpt) {
    names.excerpt =
      (typeof type.excerpt === 'object' && type.excerpt.field) || 'excerpt'
  }
  if (type?.cover) {
    names.cover =
      (typeof type.cover === 'object' && type.cover.field) || 'cover'
  }
  return names
}

/** The excerpt field that core adds: a text area in the side panel. */
function excerptField(name: string): PlutoField {
  return {
    name,
    type: 'textarea',
    label: 'Excerpt',
    description: 'A short summary for lists, feeds and search engines.',
    region: 'side',
    order: 40,
  } as PlutoField
}

/** The cover field that core adds: one image of the media library, in the side panel. */
function coverField(name: string): PlutoField {
  return {
    name,
    type: 'media',
    label: 'Cover image',
    accept: ['image/*'],
    region: 'side',
    order: 41,
  } as PlutoField
}

/**
 * The type with the fields of its standard options. A field that the type declares already stays
 * as it is (its label, its place). The same object when nothing changes.
 */
export function withStandardFields(type: PlutoContentType): PlutoContentType {
  const names = standardFieldNames(type)
  const added: PlutoField[] = []
  if (
    names.excerpt &&
    !type.fields.some((field) => field.name === names.excerpt)
  ) {
    added.push(excerptField(names.excerpt))
  }
  if (names.cover && !type.fields.some((field) => field.name === names.cover)) {
    added.push(coverField(names.cover))
  }
  return added.length === 0
    ? type
    : { ...type, fields: [...type.fields, ...added] }
}

/** The length of an excerpt made from the body. */
const STANDARD_EXCERPT_LENGTH = 200

/**
 * The keys of the standard options (`excerpt`, `cover`) on a public answer. `excerpt`: the value
 * of the excerpt field, else an excerpt that the adapter gave, else the start of the body as
 * plain text. `cover`: the media record of the cover field. A type without the option is
 * unchanged.
 */
export function withStandardPublicKeys(
  type: PlutoContentType,
  data: Record<string, unknown>,
  item: PlutoContentItem
): Record<string, unknown> {
  const names = standardFieldNames(type)
  if (!names.excerpt && !names.cover) {
    return data
  }
  const result = { ...data }
  if (names.excerpt) {
    const own = data[names.excerpt]
    if (typeof own === 'string' && own.trim()) {
      result.excerpt = own.trim()
    } else if (!(typeof data.excerpt === 'string' && data.excerpt.trim())) {
      const body = type.fields.find((field) => field.type === 'richtext')
      const markdown = body ? item[body.name] : undefined
      if (typeof markdown === 'string' && markdown.trim()) {
        result.excerpt = markdownToPlainText(markdown, STANDARD_EXCERPT_LENGTH)
      }
    }
  }
  if (
    names.cover &&
    names.cover !== 'cover' &&
    Object.hasOwn(data, names.cover)
  ) {
    result.cover = data[names.cover]
  }
  return result
}
