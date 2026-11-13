import type { ComputedRef, Ref, RendererElement } from 'vue'
import type { PlutoContentItem, PlutoContentType } from './content'

/** The layout of the generic content form. See `PlutoContentType.form`. */
export type PlutoContentFormLayout = 'default' | 'focus' | 'canvas'

/**
 * What the form shows next to its title: nothing changed, unsaved edits, a
 * save in progress, a save that worked, or a save that failed.
 */
export type PlutoSaveState = 'idle' | 'dirty' | 'saving' | 'saved' | 'failed'

/**
 * The state of the content form that a field widget can read. Get it with
 * `usePlutoContentForm()`. It is the same object for every widget of one form.
 * @see https://pluto.vulmix.dev/docs/extend/add-a-field-widget
 */
export interface PlutoContentFormContext {
  /** The content type of the form. */
  type: ComputedRef<PlutoContentType | undefined>
  /** The item being edited. The form owns it. A widget changes it through `update:modelValue`. */
  item: Ref<Record<string, unknown>>
  /** True when the form edits a saved item. False on a new item. */
  editing: ComputedRef<boolean>
  /**
   * True while the item of an edit page loads. The form, and its toolbar items, mount before
   * the item is there: a widget that reads the saved item waits for this to be false.
   */
  loading: Readonly<Ref<boolean>>
  /** True while a save runs. */
  saving: Ref<boolean>
  /** True when the item differs from the last saved (or loaded) version. */
  dirty: ComputedRef<boolean>
  /** The validation message of each field that failed the last save, by field name. */
  errorsByField: ComputedRef<Record<string, string>>
  layout: ComputedRef<PlutoContentFormLayout>
  /** True when the form uses the 'canvas' layout. */
  canvas: ComputedRef<boolean>
  /**
   * True on a side while its panel is closed and a small "open" button floats at the top of that
   * side of the canvas (desktop only). A canvas widget keeps that corner free: the left button
   * covers the area from 12 to 40px, the right button from 16 to 44px, both from 10 to 38px down.
   */
  panelToggles: ComputedRef<{ left: boolean; right: boolean }>
  /**
   * Runs `callback` after each save that worked, with the saved item. It
   * returns a function that stops the callback. Vue stops it too when the
   * calling component unmounts, if the call is inside `setup`.
   */
  onSaved: (callback: (item: PlutoContentItem) => void) => () => void
  /**
   * Runs `callback` synchronously before the form builds the payload of a save, and before the
   * form writes a backup (also when the page hides). A widget that holds edits outside its
   * `modelValue` (for example an editor with a debounce) writes them to the model there. It
   * returns a function that stops the callback. Vue stops it too when the calling component
   * unmounts, if the call is inside `setup`.
   */
  onFlush: (callback: () => void) => () => void
  /** Opens the right panel and shows the tab with this `PlutoContentCanvasPanel` id. 'canvas' layout only. */
  openPanel: (id: string) => void
  /**
   * Sets the value of one field by name, with the rules of the form (a change of the slug field
   * stops the slug from following the title). For a widget that edits a field other than its own,
   * such as the title above the post editor.
   */
  updateField: (name: string, value: unknown) => void
}

/** One panel that a widget adds to the 'canvas' layout. See `PlutoContentCanvasPanel`. */
export interface PlutoCanvasPanelDef {
  /** Unique in the form. The right panel uses it as the tab value. */
  id: string
  /** `left` is the side panel left of the canvas. `right` is a tab of the right panel. */
  side: 'left' | 'right'
  /** The tab label (right) or the slideover title (left). */
  label?: string
  /** The tab icon (right). */
  icon?: string
}

/** The part of the 'canvas' layout that `PlutoContentCanvasPanel` talks to. Internal. */
export interface PlutoCanvasHost {
  /** Adds a panel. It returns a function that removes it. */
  registerPanel: (def: () => PlutoCanvasPanelDef) => () => void
  /** The element of the left panel. `null` while the left panel is closed. */
  leftTarget: Ref<RendererElement | null>
  /** The element of one right tab. `null` before the tab mounts. */
  rightTarget: (id: string) => RendererElement | null
  /**
   * Takes fields out of the right panel, because the widget shows them itself (the post editor
   * shows the title above the text). It returns a function that gives them back.
   */
  claimFields: (names: () => string[]) => () => void
  /**
   * Shows the alerts of the form (a locked item, a recovery offer, a conflict, the errors of the
   * last save) in this element, in the column of the widget (the post editor puts them above the
   * title, as wide as its toolbar). It returns a function that gives them back: then the form shows
   * them above the canvas.
   */
  claimAlerts: (target: RendererElement) => () => void
}

/** One button of `PlutoContentFormHeader`. */
export interface PlutoFormHeaderButton {
  id: string
  label: string
  icon: string
  /** `solid` is the main button. */
  variant?: 'solid' | 'outline' | 'soft' | 'subtle' | 'ghost' | 'link'
  color?:
    | 'primary'
    | 'secondary'
    | 'success'
    | 'info'
    | 'warning'
    | 'error'
    | 'neutral'
  /** On a narrow screen a secondary button shows its icon only. */
  secondary?: boolean
}

/** A panel toggle button of `PlutoContentFormHeader`. */
export interface PlutoFormHeaderToggle {
  label: string
  icon: string
}
