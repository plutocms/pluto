import type { InjectionKey } from 'vue'

/**
 * `PlutoContentForm` provides the form context under this key. Read it with
 * `usePlutoContentForm()`.
 */
export const plutoContentFormKey: InjectionKey<PlutoContentFormContext> = Symbol('plutoContentForm')

/**
 * `PlutoContentForm` provides this key in the 'canvas' layout.
 * `PlutoContentCanvasPanel` reads it. A widget does not use it directly.
 */
export const plutoCanvasHostKey: InjectionKey<PlutoCanvasHost> = Symbol('plutoCanvasHost')

/**
 * The context of the content form that holds the calling component. Use it in
 * a field widget to read the item, the dirty state, or the field errors, or to
 * run code after a save.
 *
 * It returns `null` outside a `PlutoContentForm`, for example when a widget
 * renders in another page. Check for it.
 *
 * ```ts
 * const form = usePlutoContentForm()
 * form?.onSaved(() => refetchMedia())
 * ```
 */
export function usePlutoContentForm(): PlutoContentFormContext | null {
  return inject(plutoContentFormKey, null)
}
