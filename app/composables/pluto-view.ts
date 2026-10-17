import type { InjectionKey, Ref } from 'vue'

/**
 * `PlutoViewAdminPanel` provides this key. It is `true` while the panel
 * holds its aside in a resizable splitter panel (desktop, aside open).
 * `PlutoViewAside` then fills that panel instead of using its own fixed
 * `width`.
 */
export const plutoViewAsideResizableKey: InjectionKey<Ref<boolean>> = Symbol('plutoViewAsideResizable')
