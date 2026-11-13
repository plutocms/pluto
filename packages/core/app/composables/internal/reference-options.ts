// No Nuxt auto-imports here: plain Vitest imports this file.

import type {
  PlutoContentItem,
  PlutoContentType,
} from '../../../shared/types/content'

export type ReferenceSlugify = (title: string) => string

export interface PlutoReferenceOption {
  label: string
  value: string | number
  slug?: string
  image?: string
}

export function referenceSlugField(
  type: PlutoContentType | undefined
): string | undefined {
  return type?.fields.find((field) => field.type === 'slug')?.name
}

export function referenceImageField(
  type: PlutoContentType | undefined
): string | undefined {
  return type?.fields.find(
    (field) =>
      field.type === 'media' &&
      !field.multiple &&
      (!field.accept?.length ||
        field.accept.some((accept) => accept.startsWith('image/')))
  )?.name
}

export function referenceOptionsFromItems(
  type: PlutoContentType | undefined,
  items: readonly PlutoContentItem[]
): PlutoReferenceOption[] {
  const slugField = referenceSlugField(type)
  const imageField = referenceImageField(type)
  return items.map((item) => {
    const title = type?.titleField ? item[type.titleField] : undefined
    const label =
      typeof title === 'string' || typeof title === 'number'
        ? String(title).trim()
        : ''
    const slug = slugField ? item[slugField] : undefined
    const imageValue = imageField ? item[imageField] : undefined
    const image = Array.isArray(imageValue) ? imageValue[0] : imageValue
    return {
      label: label || String(item.id),
      value: item.id,
      ...(typeof slug === 'string' && slug !== '' && { slug }),
      ...(typeof image === 'string' && image !== '' && { image }),
    }
  })
}

function normalize(value: string): string {
  return value.trim().toLocaleLowerCase()
}

export function findReferenceOption(
  options: readonly PlutoReferenceOption[],
  text: string,
  slugify: ReferenceSlugify
): PlutoReferenceOption | undefined {
  const wanted = normalize(text)
  if (wanted === '') {
    return undefined
  }
  const slug = slugify(text)
  return options.find(
    (option) =>
      normalize(option.label) === wanted ||
      (option.slug !== undefined && option.slug === slug) ||
      (typeof option.value === 'string' && option.value === slug)
  )
}

export function referenceCreateBody(
  type: PlutoContentType | undefined,
  title: string,
  slugify: ReferenceSlugify
): Record<string, string> {
  const trimmed = title.trim()
  const slugField = referenceSlugField(type)
  return {
    [type?.titleField ?? 'title']: trimmed,
    ...(slugField && { [slugField]: slugify(trimmed) }),
  }
}

export function withUnknownIds(
  options: readonly PlutoReferenceOption[],
  ids: ReadonlyArray<string | number>
): PlutoReferenceOption[] {
  const known = new Set(options.map((option) => String(option.value)))
  const extra: PlutoReferenceOption[] = []
  for (const id of ids) {
    if (!known.has(String(id))) {
      known.add(String(id))
      extra.push({ label: String(id), value: id })
    }
  }
  return extra.length > 0 ? [...options, ...extra] : [...options]
}

export function isReferenceCacheFresh(
  fetchedAt: number | undefined,
  now: number,
  maxAgeMs = 10_000
): boolean {
  return fetchedAt !== undefined && now - fetchedAt < maxAgeMs
}

export function referenceOptionsToPublic(
  options: readonly PlutoReferenceOption[]
): Map<string, { id: string | number; label: string; slug?: string }> {
  return new Map(
    options.map((option) => [
      String(option.value),
      {
        id: option.value,
        label: option.label,
        ...(option.slug !== undefined && { slug: option.slug }),
      },
    ])
  )
}
