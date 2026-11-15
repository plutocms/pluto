import type { InjectionKey, MaybeRefOrGetter } from 'vue'

/** How the blocks render in the preview. */
export interface PlutoPreviewRenderOptions {
  /** `false` renders the HTML tags without the `Prose*` components. */
  prose?: boolean
  /** A map of tag to the name of a global component, like `{ a: 'prose-a' }`. */
  components?: Record<string, string>
}

export const plutoPreviewRenderKey: InjectionKey<
  MaybeRefOrGetter<PlutoPreviewRenderOptions>
> = Symbol('pluto-preview-render')

/**
 * Sets how the blocks render in the preview of the visual editor. Call it in
 * the site's own `PlutoContentPreview`, when a page renders with other
 * options than the default. For example, a landing page
 * with `:prose="false"`:
 *
 * ```ts
 * usePlutoPreviewRender(() => (props.frontmatter.id === 'index' ? { prose: false } : {}))
 * ```
 *
 * @see https://pluto.vulmix.dev/docs/extend/edit-pages-visually
 */
export function usePlutoPreviewRender(
  options: MaybeRefOrGetter<PlutoPreviewRenderOptions>
) {
  provide(plutoPreviewRenderKey, options)
}
