// Pure part of `usePlutoReferenceOptions`. It does not use Nuxt auto-imports, so plain Vitest
// can import it. It has no runtime import from `shared/` (a layer build cannot resolve one from
// `app/`), so the caller passes `slugifyTitle`.

/** Makes a slug from a title. Core gives `slugifyTitle`. */
import type {
  PlutoContentItem,
  PlutoContentType,
} from '../../../shared/types/content'

export type ReferenceSlugify = (title: string) => string

/** One choice of a reference widget: the id of an item of the target type and its label. */
export interface PlutoReferenceOption {
  label: string
  value: string | number
  /** The slug of the item, when the target type has a slug field. */
  slug?: string
}

/** The name of the slug field of a type, if it has one. */
export function referenceSlugField(
  type: PlutoContentType | undefined
): string | undefined {
  return type?.fields.find((field) => field.type === 'slug')?.name
}

/** The options of a list of items. An item with no title shows its id. */
export function referenceOptionsFromItems(
  type: PlutoContentType | undefined,
  items: readonly PlutoContentItem[]
): PlutoReferenceOption[] {
  const slugField = referenceSlugField(type)
  return items.map((item) => {
    const title = type?.titleField ? item[type.titleField] : undefined
    const label =
      typeof title === 'string' || typeof title === 'number'
        ? String(title).trim()
        : ''
    const slug = slugField ? item[slugField] : undefined
    return {
      label: label || String(item.id),
      value: item.id,
      ...(typeof slug === 'string' && slug !== '' && { slug }),
    }
  })
}

function normalize(value: string): string {
  return value.trim().toLocaleLowerCase()
}

/** The option whose label or slug equals the text (case and edge spaces do not count). */
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

/** The body that creates an item of the target type from a typed title. */
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

/**
 * The options for the menu: the loaded options, plus one option for each id that has none (a
 * deleted item, or an option that is not loaded). Such an option shows the id as its text.
 */
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

/** True while a cache entry from `fetchedAt` may serve a new widget. */
export function isReferenceCacheFresh(
  fetchedAt: number | undefined,
  now: number,
  maxAgeMs = 10_000
): boolean {
  return fetchedAt !== undefined && now - fetchedAt < maxAgeMs
}

/** The options as public references, by id, for `toPreviewItem`. */
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
