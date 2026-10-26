import type { InjectionKey, Ref } from 'vue'

/**
 * `PlutoViewAdminPanel` provides this key. It is `true` while the panel
 * holds its aside in a resizable splitter panel (desktop, aside open).
 * `PlutoViewAside` then fills that panel instead of using its own fixed
 * `width`.
 */
export const plutoViewAsideResizableKey: InjectionKey<Ref<boolean>> = Symbol('plutoViewAsideResizable')

/** The left panel of a `PlutoViewAdminPanel`, for the collapse button in its header. */
export interface PlutoViewLeftPanel {
  /** Hides the left panel. */
  close: () => void
  /** How many `PlutoViewLeftCollapse` buttons are mounted in the panel now. */
  collapseButtons: Ref<number>
}

/** `PlutoViewAdminPanel` provides this key. `PlutoViewLeftCollapse` reads it. */
export const plutoViewLeftPanelKey: InjectionKey<PlutoViewLeftPanel> = Symbol('plutoViewLeftPanel')
