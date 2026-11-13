import type { PlutoContentType } from './content'
import type { PlutoPublicMedia } from './media'
import type { PlutoPublicReference } from './public-api'

/**
 * The content types of the app, by name. Core fills it at build time from every
 * `export const x = defineContentType({ ... })` among the auto-imports (the type template
 * `types/pluto-content-types.d.ts`), so a composable that takes a type name knows its item. A layer
 * or an app can also add an entry by hand:
 *
 * ```ts
 * declare global {
 *   interface PlutoContentTypes {
 *     event: typeof eventType
 *   }
 * }
 * ```
 */
declare global {
  interface PlutoContentTypes {}
}

/** The value of one field in a public answer. */
type PublicFieldValue<F> = F extends { type: 'number' }
  ? number
  : F extends { type: 'boolean' }
    ? boolean
    : F extends {
          type: 'select'
          options: ReadonlyArray<{ value: infer V }>
        }
      ? V
      : F extends { type: 'reference'; target: string; multiple: true }
        ? PlutoPublicReference[]
        : F extends { type: 'reference'; target: string }
          ? PlutoPublicReference
          : F extends { type: 'reference'; multiple: true }
            ? Array<string | number>
            : F extends { type: 'reference' }
              ? string | number
              : F extends { type: 'media'; multiple: true }
                ? PlutoPublicMedia[]
                : F extends { type: 'media' }
                  ? PlutoPublicMedia
                  : string

/** The stored fields of a type: every field that is not `virtual`. */
type StoredFields<T extends PlutoContentType> = Exclude<
  T['fields'][number],
  { virtual: true }
>

/** The fields of the public answer: `api.fields` when the type sets it, else every stored field. */
type PublicFields<T extends PlutoContentType> = T extends {
  api: { fields: ReadonlyArray<infer K extends string> }
}
  ? Extract<StoredFields<T>, { name: K }>
  : StoredFields<T>

/** The keys that the type options add: `excerpt` and the cover field. */
type OptionKeys<T extends PlutoContentType> = (T extends {
  excerpt: true | object
}
  ? { excerpt?: string | null }
  : unknown) &
  (T extends { cover: { field: infer C extends string } }
    ? { [K in C]?: PlutoPublicMedia | null }
    : T extends { cover: true | object }
      ? { cover?: PlutoPublicMedia | null }
      : unknown)

type Simplify<T> = { [K in keyof T]: T[K] } & {}

/**
 * One item of a type in the public API (`usePlutoSingleton`, `usePlutoPublicItem`), from the type
 * definition: `id`, the timestamps, and each public field. A `required` field is always there; any
 * other field is optional and can be `null`. Needs a type declared with `defineContentType`, which
 * keeps the literal names and field types.
 */
export type PlutoPublicItemOf<T extends PlutoContentType> = Simplify<
  {
    id: string | number
    createdAt?: string
    updatedAt?: string
    publishedAt?: string
  } & {
    [
      F in PublicFields<T> as F extends { required: true } ? F['name'] : never
    ]: PublicFieldValue<F>
  } & {
    [
      F in PublicFields<T> as F extends { required: true } ? never : F['name']
    ]?: PublicFieldValue<F> | null
  } & OptionKeys<T>
>

/** The name of a content type of the app (a key of `PlutoContentTypes`). */
export type PlutoContentTypeName = keyof PlutoContentTypes & string

/**
 * The public item of a content type of the app, by name: `PlutoItem<'contact'>`. See
 * `PlutoContentTypes`.
 */
export type PlutoItem<N extends PlutoContentTypeName> =
  PlutoContentTypes[N] extends PlutoContentType
    ? PlutoPublicItemOf<PlutoContentTypes[N]>
    : never

/**
 * The name of a singleton type of the app (`singleton: true` or `{ id }`): the names that
 * `usePlutoSingleton` suggests.
 */
export type PlutoSingletonTypeName = {
  [N in PlutoContentTypeName]: PlutoContentTypes[N] extends {
    singleton: true | { id?: string }
  }
    ? N
    : never
}[PlutoContentTypeName]
