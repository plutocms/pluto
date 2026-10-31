import type { InjectionKey, MaybeRefOrGetter } from 'vue'

/** How the blocks render in the preview: the same options as the `ContentRenderer` of the site page. */
export interface PlutoPreviewRenderOptions {
  /** `false` renders the HTML tags without the prose components, like `<ContentRenderer :prose="false">`. */
  prose?: boolean
  /** A map of tag to component, like the `components` prop of `ContentRenderer`. */
  components?: Record<string, string>
}

export const plutoPreviewRenderKey: InjectionKey<
  MaybeRefOrGetter<PlutoPreviewRenderOptions>
> = Symbol('pluto-preview-render')

/**
 * Sets how the blocks render in the preview of the visual editor. Call it in
 * the site's own `PlutoContentPreview`, when a page renders with other
 * `ContentRenderer` options than the default. For example, a landing page
 * with `:prose="false"`:
 *
 * ```ts
 * usePlutoPreviewRender(() => (props.frontmatter.id === 'index' ? { prose: false } : {}))
 * ```
 */
export function usePlutoPreviewRender(
  options: MaybeRefOrGetter<PlutoPreviewRenderOptions>
) {
  provide(plutoPreviewRenderKey, options)
}
