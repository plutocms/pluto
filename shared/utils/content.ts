import type { PlutoContentType } from '../types/content'

/**
 * Declares a content type. This is an identity function: it returns `type`
 * unchanged. Its only job is type inference at the call site — wrapping a
 * content type literal in `defineContentType` lets TypeScript narrow each
 * `PlutoField`'s `type` correctly — plus a handful of dev-only sanity
 * checks below. This mirrors `definePlutoExtension`'s role: a thin, typed
 * entry point, not a place that does real work.
 *
 * The checks only warn, and only in dev (`import.meta.dev` strips them
 * from a production build). A content type with a typo still loads. The
 * warning exists to catch the typo before it reaches a later wave's
 * generic list/form UI or server adapter, where it would fail silently or
 * confusingly instead.
 */
export function defineContentType(type: PlutoContentType): PlutoContentType {
  if (import.meta.dev) {
    const prefix = `[pluto] content type "${type.name}":`
    const seen = new Set<string>()

    for (const field of type.fields) {
      if (seen.has(field.name)) {
        console.warn(`${prefix} duplicate field name "${field.name}".`)
      }
      seen.add(field.name)

      if (field.type === 'select' && field.options.length === 0) {
        console.warn(`${prefix} select field "${field.name}" has no options.`)
      }
    }

    if (!type.fields.some((field) => field.name === type.titleField)) {
      console.warn(`${prefix} titleField "${type.titleField}" does not match any field.`)
    }

    if (type.slug) {
      const slug = type.slug
      const field = type.fields.find((candidate) => candidate.name === slug.field)
      if (!field || field.type !== 'slug') {
        console.warn(`${prefix} slug.field "${slug.field}" does not name a field of type "slug".`)
      }
    }

    if (type.status && type.status.values.length === 0) {
      console.warn(`${prefix} status has no values.`)
    }
  }

  return type
}
