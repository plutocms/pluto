import type {
  PlutoContentItem,
  PlutoContentType,
  PlutoField,
} from '../types/content'
import { markdownToPlainText } from '../markdown/render'

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

const STANDARD_EXCERPT_LENGTH = 200

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
