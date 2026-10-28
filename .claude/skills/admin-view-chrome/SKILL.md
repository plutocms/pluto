# Admin view chrome

This feature gives one page in the admin area a consistent shell: a toolbar row, a scrollable
main area, and an optional right-hand aside. `PlutoContentList` and `PlutoContentForm` both use
it. It also adds the publish workflow to the generic content form, and a registry bucket that
lets a layer add its own buttons to that form.

It extends the [content model](../content-model/SKILL.md). Read that skill file first. This
feature adds:

- `app/components/Pluto/View/PlutoViewAdminPanel.vue`, `PlutoViewToolbar.vue`, `PlutoViewAside.vue`
  — the three per-view chrome primitives described below.
- `PlutoContentType.form` on `shared/types/content.ts` — layout knobs for the generic form.
- `PlutoContentTypeCapabilities.publish` on `shared/types/content.ts` — the publish capability.
- `PlutoContentAction`/`PlutoContentActionContext` on `shared/types/registry.ts`, a
  `contentActions` field on `PlutoExtension`, and a `contentActions` bucket on `PlutoRegistry`.
- `app/composables/pluto-content-actions.ts` — `usePlutoContentActions(typeName, placement)`.
- `shared/utils/content-map.ts` (extended) — `mapColumnsToFields` now also returns `item.status`.
- `PlutoContentList.vue` and `PlutoContentForm.vue` (rewired) — both now render inside
  `PlutoViewAdminPanel`, and `PlutoContentForm` adds the publish workflow UI.
- `PlutoContentFormHeader.vue` — the toolbar of every form layout (see "The form toolbar").
- `PlutoContentCanvasPanel.vue`, `usePlutoContentForm()` and the `canvas` layout (see "The canvas
  layout" and "The form context").
- `app/composables/internal/content-dirty.ts` — the pure part of the unsaved-changes guard.
- `test/content-actions.test.ts`, `test/content-dirty.test.ts` — unit tests.

## Three chrome primitives, not the global layout

Do not confuse these with `app/layouts/admin.vue` or `PlutoNavbarAdmin.vue`. Those two are
**app-level, one per admin session**: the layout owns the left sidebar and the page frame, and
`PlutoNavbarAdmin` is the single global top bar that core renders. A page's
own content renders inside the layout's body slot.

`PlutoViewAdminPanel`, `PlutoViewToolbar`, and `PlutoViewAside` are **per-view, one set per page**.
They give one page (a content list, a content form, or any other admin page) its own local
toolbar and optional aside, inside the space the global layout already gives it.

### `PlutoViewAdminPanel`

The outer shell for one view. Props:

- `width?: 'container' | 'full'` — default `'container'`. `'container'` wraps the main slot in a
  max-width `UContainer`. `'full'` drops that wrap, for a view that wants to use the whole width
  (a writing surface, a media grid).
- `asideOpen?: boolean` (`v-model:aside-open`) — default `false`. Pass the same value as the
  aside's `v-model:open`.
  While it is `true` on desktop, the aside sits in a resizable panel (see "Resizable aside"
  below). Without it, the aside keeps its fixed `width`.
- `leftOpen?: boolean` (`v-model:left-open`) — default `false`. Whether the left panel is open.
  See "The left panel".
- `panelToggles?: boolean` — default `false`. On desktop, draws a small floating button that opens
  a closed side panel (see "The canvas layout"). Use it with `v-model:aside-open`.
- `leftTitle?: string` — the title of the left panel when it shows as a slideover.
- `fill?: boolean` — default `false`. The main region fills the panel's height and does not
  scroll. The content scrolls inside its own region instead, for a view with one long list
  (such as a virtualized table). The content must be a flex column child that takes
  `flex-1 min-h-0` and scrolls itself.

Slots:

- `#toolbar` — a shrink-to-fit row pinned above the scrollable area. Put a `PlutoViewToolbar`
  here.
- default — the scrollable main content.
- `#left` — a column left of the main content. Put the panel content here. See "The left panel".
- `#aside` — a column beside the main content, resizable when `asideOpen` is set. Put a
  `PlutoViewAside` here. Leave
  this slot empty on a view with nothing to show beside the main content — an empty aside slot
  renders as a zero-width wrapper, so it costs nothing to leave unused.

### `PlutoViewToolbar`

One row of controls for a view: a back button, a title, and left/right button groups. Wraps
Nuxt UI's `UDashboardNavbar` with one fix — `:toggle="false"` — because the vendor default
toggle button controls the app-level LEFT sidebar through a global hook. A second, page-local
toolbar must never render that button, or it would open and close the wrong sidebar.

Props: `title?: string`, `icon?: string`, `backTo?: string` (renders a back arrow button, with an `aria-label` and a tooltip "Back", before
the title).

Slots: `#left` (replaces the whole leading area — icon, title, and trailing content — so only use
it when you also want to replace the title), `#title`, default (a centered slot), `#right`,
`#trailing` (renders right after the title, inside the same leading area — the natural place for
a small button that belongs next to the title, like a refresh button).

### `PlutoViewAside`

A right-hand panel bound to an `open` model (`v-model:open`). On a wide screen (`lg`, 64rem and
up) it renders as a plain `<aside>` beside the main content. On a narrow screen it renders as a
`USlideover` instead. Props: `title?: string`, `width?: number` (desktop width in px, default
320; ignored inside a resizable panel). On desktop the header has a collapse button
(`lucide:panel-right-close`, "Hide the panel", `pluto.common.hidePanel`) with an `aria-label` and a
tooltip.
Slot `#header` replaces the title, for example with tabs. On a narrow screen it goes into the
slideover title.

A `useMediaQuery` check renders the plain `<aside>` on wide screens only, and the `USlideover`
on narrow screens only, so the slot mounts once. Do not replace that check with `hidden lg:flex`
or `lg:hidden` classes:

- CSS hides a copy, but the copy stays mounted. Each copy fetches its own field options, so a
  narrow screen made two requests per option list on every open.
- An open slideover is a modal dialog. It disables pointer events on the rest of the page even
  while CSS hides it, so the desktop page stops taking clicks.

The slideover sets `unmount-on-hide="false"`. After the first open, its slot stays mounted
(hidden) when it closes. A reopen keeps the widget state, such as an open picker or a typed
search, and does not fetch the field options again. Field values live in the form state, so
they were never lost; only the widgets' own local state was.

### Resizable aside

`PlutoViewAdminPanel` puts the main content and the aside in a Nuxt UI `USplitter` when
`asideOpen` is `true` on desktop. The user drags the handle to resize the aside, between 240px
and 560px. The panel stores the width in px in the `pluto-view-aside-width` cookie and applies it
the next time the aside opens. `PlutoViewAside` reads the `plutoViewAsideResizableKey` injection
and fills the panel instead of using its own `width`.

Do not give the `USplitter` an `id`. With an id, Nuxt UI names each handle `<id>-handle-<index>`, and
reka-ui reads that name once, when the handle mounts. The left panel of the canvas layout joins later
(it loads on demand), so the indexes shift, two handles get the same name, and a drag on the aside
handle resized the left panel (fixed in 0.28). Without an id, each handle gets a unique id. The panels
keep their own `id` (`pluto-view-left`, `-main`, `-aside`).

Do not use the splitter's `sizeUnit: 'px'` or `autoSaveId` here. When the aside panel joins with
the aside already open (a page reload), reka-ui skips the px conversion and reads the px value as
a raw size, so the aside takes most of the width. The panel converts px to percentages itself,
against the measured row width.

Like `PlutoViewToolbar`, this is a hand-built stand-in rather than Nuxt UI's own
`UDashboardSidebar`, for the same reason: `UDashboardSidebar` listens to a global toggle hook,
and a second instance of it here would fight the app-level sidebar for that hook.

### The left panel

`PlutoViewAdminPanel` has a `#left` slot and a `leftOpen` model. It works like the aside:

- Desktop: the left panel sits in the same `USplitter` as the main content and the aside, in the
  order left, main, aside. The user drags the handle, between 200px and 400px. The panel stores
  the width in px in the `pluto-view-left-width` cookie (default 260) and converts it to
  percentages itself, for the same reason as the aside.
- Below `lg`: the panel renders a left `USlideover` (`unmount-on-hide="false"`) with the slot
  inside, and the splitter has no left panel. The slot mounts once.
- A view can fill `#left` after the first render (a widget that loads on demand adds it). The
  panel reads `useSlots()` again before each update, because `useSlots()` is not reactive.
- The collapse button of the left panel goes in the header of the panel content: put
  `<PlutoViewLeftCollapse />` there (it shows on desktop only; the slideover has its own close).
  It reads `plutoViewLeftPanelKey` (`close()`, `collapseButtons`). The panel exposes
  `leftCollapsible` (true while one is mounted) through a template ref.

## List states in `PlutoContentList`

While the list has no rows, `PlutoContentList` shows one Nuxt UI `UEmpty` instead of the cards
(mobile) and the table (desktop):

- **Loading** — the first request is pending. Title "Loading <plural>…" with a spinner.
- **Error** — the request failed. Title "Could not load <plural>" and a "Try again" button.
- **Empty** — the request returned no rows. Title "No <plural> yet", the content type icon,
  and a "New <label>" button if the user has `capabilities.write`.

With rows, a failed refresh keeps the rows and shows a `UAlert` above them, with a "Try again"
button. The toolbar Refresh button and both "Try again" buttons call `retry()`, which catches
the rejection. Do not call `refresh()` directly from a button: it rethrows, and the failure
becomes an unhandled rejection. The toolbar create button reads "New <label>", the same text
as the command palette.

### Long lists

`PlutoContentList` loads 50 rows at a time (`usePlutoContentList(type, { pageSize: 50 })`). It
uses `PlutoViewAdminPanel` with `fill`, so the list scrolls inside its own region and the page
does not scroll:

- Desktop: `UTable` with `virtualize` (only the visible rows render) and `sticky` (the header
  row stays at the top). The table fills the remaining height.
- Mobile: the card list is a flex column that scrolls. Each card has `shrink-0`. In a grid or
  flex container with a fixed height, a card without it collapses to its border.
- `useInfiniteScroll` on the table and on the card list calls `loadMore()` 240px before the
  end. It stops while an error shows, so a failing page does not load in a loop.
- A footer shows "Showing <loaded> of <total> <plural>", and "Loading more…" while a page
  loads.

### List text and numbers

Every list string is a key in `pluto.list.*` (and `pluto.common.*`). A phrase takes the labels as
parameters, such as `{labelPlural}`, so a language can reorder the words. The code passes the
label in lowercase (`usePlutoContentText(...).labelPluralLower`). The counts in the footer use
`n()` from `usePlutoI18n()`, so they follow the admin language. See the i18n skill.

## `PlutoContentType.form` — form layout knobs

```ts
form?: {
  /**
   * 'default' = fields in a container, aside on the right. 'focus' = minimal chrome for a writing
   * surface. 'canvas' = a full-height field between a left panel and a right panel.
   */
  layout?: 'default' | 'focus' | 'canvas'
  /** The field that fills the main region in the 'canvas' layout. */
  canvasField?: string
  /** true = always show. false = never. 'auto' (default) = show when any field has region 'side'. */
  aside?: boolean | 'auto'
  /** Aside starts closed. Default false, or true when layout is 'focus'. */
  asideCollapsed?: boolean
  /** Drop the max-width container in the main region. Default false, or true when layout is 'focus'. */
  width?: 'container' | 'full'
}
```

`PlutoContentForm` reads all of them. `layout: 'focus'` uses the full width and defaults the aside
to collapsed — the shape a long-form writing surface wants. `layout: 'canvas'` is described below.
Leave `form` unset for the default two-column form every other content type already gets.

`PlutoContentType.previewUrl?: (item) => string | undefined` gives the public URL of an item. The
toolbar shows a "View" link (new tab) in edit mode when it returns a value. The function must be
pure, because the type is shared with the server. A function that throws shows no link.

## The form toolbar

Every layout (`default`, `focus`, `canvas`) has the same toolbar, `PlutoContentFormHeader`. The body
has no H1: the toolbar title is the heading. The toolbar shows, from left to right:

- Back, then "<Type plural> › <item title>". In edit mode the title is the `titleField` value, or
  "Edit <type>" while it loads or when it is empty. A new item shows "New <type>". The type label
  hides below `sm` (40rem) and the title truncates.
- The save state, in a live region (`role="status"`):
  - "Unsaved changes" (a dot, the text from `md`).
  - "Saving…".
  - "Saved just now", then "Saved 2 minutes ago" (`Intl.RelativeTimeFormat`, the admin locale, a
    30 second tick). It shows after a save while the form has no new change.
  - "Save failed." with a "Retry" button, which repeats the same save (Publish stays Publish).
- The status badge (when the type has a `status` workflow), the "View" link, the
  `contentToolbarItems` of the layers (a status or an indicator), the `contentActions` of the layer, the save and publish buttons (see "The publish workflow"), the overflow menu, and
  the panel toggles.
- Below `sm`: the "View" link moves into the overflow menu, and a secondary button (a content
  action, "Save draft") shows its icon only.

`PlutoContentFormHeader` holds no form logic. It gets plain props (`title`, `saveState`,
`viewUrl`, `buttons`, `actions`, and so on) and sends `press`, `retry`, `unpublish`, `delete`,
`toggleAside` and `toggleLeft`. `PlutoContentForm` builds the data and handles the events.

### Unsaved changes

The form is dirty when the payload (`buildContentPayload`, compared as sorted JSON) differs from
the baseline. The baseline follows the item **until the user first edits**, so a widget that
writes its own normal form of the value after it mounts (an editor) does not make the form
dirty. A key press, `input`, `change`, `paste`, `drop`, or a press on a control (button, link,
input, `role="option"` and similar) counts as an edit. An event during the load does not count.
A save sets a new baseline (twice: at once, and on the next tick). The logic is
`createDirtyTracker` in `app/composables/internal/content-dirty.ts`.

While the form is dirty:

- A navigation away (`onBeforeRouteLeave`, and `onBeforeRouteUpdate` for a new id) is cancelled
  and opens an in-app dialog, "Leave without saving?", with "Stay on this page" and "Leave
  without saving". Escape and a click outside mean "Stay". "Leave" navigates to the wanted route.
- `beforeunload` asks the browser to confirm a reload or a tab close.

The form skips the guard for its own navigation (after a create, an id change, and a delete).

**Ctrl+S** (Cmd+S on macOS) saves like the Save button (not Publish) and stops the browser's save
dialog. It does nothing while a save runs, while a dialog is open, or when the user cannot write.

## The form context

`usePlutoContentForm()` (`app/composables/pluto-content-form.ts`, types in
`shared/types/content-form.ts`) gives a field widget the state of its form. It returns `null`
outside a `PlutoContentForm`, so check for it. The widget contract (`field`, `modelValue`,
`disabled`, `update:modelValue`) does not change.

```ts
const form = usePlutoContentForm()
form?.onSaved((saved) => refetchMedia(saved.id)) // after each save that worked
```

| Key | Meaning |
|---|---|
| `type`, `item`, `editing` | the content type, the item (owned by the form), edit mode |
| `saving`, `dirty` | a save runs, the item has unsaved changes |
| `errorsByField` | the validation message of each field that failed the last save |
| `layout`, `canvas` | the layout, and true for 'canvas' |
| `onSaved(callback)` | runs after each save that worked, with the saved item. Returns a stop function. Vue stops it with the calling scope. |
| `openPanel(id)` | opens the right panel on one `PlutoContentCanvasPanel` tab ('canvas' only) |

## The canvas layout

`form: { layout: 'canvas', canvasField: 'body' }` gives a full-height field between a left panel and
a right panel. `defineContentType` warns in dev when `canvasField` names no field.

- The `canvasField` widget fills the main region (`PlutoViewAdminPanel` with `fill` and `width: 'full'`).
  Its root must fill its parent (`h-full`) and scroll its own content.
- Every other field goes in the "Page" tab of the right panel, sorted by `order`. `region` does not
  matter in this layout.
- A widget adds panels with `PlutoContentCanvasPanel` (props `side: 'left' | 'right'`, `id`,
  `label?`, `icon?`; slot: the panel content):
  - `left`: the content stacks in the left panel. Put `PlutoViewLeftCollapse` in its header.
  - `right`: the content is one tab of the right panel (`UTabs`, widget panels first, then "Page").
    With one tab, the aside title shows its label and there are no tabs.
- The panel content stays in the widget's component tree. Vue `Teleport`s the DOM into an element
  of the form. The element is a ref, so the content mounts when the element exists (the panel is
  open, the tab mounted) and the state of the widget does not reset. Outside a canvas form,
  `PlutoContentCanvasPanel` renders its slot inline.
- Desktop: an open panel closes from the button in its own header. A closed panel opens from a
  small square button (`variant="outline"`, `size="sm"`) that floats at the place of that header
  button: top left of the row for the left panel, top right for the aside.
  `PlutoViewAdminPanel` draws them with `panel-toggles` (the form sets it, with
  `v-model:aside-open`; `asideOpen` is a model now). The form toolbar shows no panel toggle on
  desktop, except the left one while the left panel is open and has no `PlutoViewLeftCollapse`.
- Narrow screen: the toolbar toggles open the slideovers.
- Below `lg`: the left panel is a slideover (a toggle), the right panel is a slideover (a toggle).
  Both start closed and keep no cookie (a saved "open" would cover the page on the first visit).
  On desktop the left state is the cookie `pluto-content-left-<typeName>` and the right state is
  `pluto-content-aside-<typeName>`.

Use `openPanel('block')` from the widget to bring a tab forward, for example when the user selects
a block.

Every icon-only button in the form toolbar has an `aria-label` and a `UTooltip`: the aside toggle
("Show settings" / "Hide settings") and the overflow menu ("More actions").

**Narrow screens (below `lg`, 64rem).** With `layout: 'default'`, the form renders the aside
fields inline, in a titled "Settings" section under the main fields, and renders no slideover and
no aside toggle. A required field, such as a price, never hides behind a button. With
`layout: 'focus'` (the blog post type), the aside stays a slideover and the toggle stays. On a
wide screen nothing changes. The form reads the breakpoint with `useMediaQuery`, as
`PlutoViewAside` does.

The aside's open/closed state persists per content type, in a cookie keyed
`pluto-content-aside-<typeName>`, so a user's choice survives a page reload.

## The publish workflow

A content type opts into a draft/published workflow by setting `status` (see the content-model
skill for the full `PlutoContentStatus` shape: `values`, `default`, `publishedValue`,
`publishedAtColumn`, `column`). `PlutoContentForm` reads `type.status` to decide what to show:

- No `status` declared (`status` unset or `false`) — one plain "Save" button. Byte-identical to
  a content type with no publish workflow at all; `onSave()` is called with no argument.
- `status` declared, current value is not `publishedValue` — a "Save draft" button plus a
  "Publish" button. Publish calls `onSave(publishedValue)`. A save with no override is a plain
  "Saved" (the toast does not say "Unpublished").
- `status` declared, current value is `publishedValue` — an "Update" button, plus an "Unpublish"
  entry in the overflow menu that calls `onSave(draftValue)`.

`status` travels at a fixed payload key: `onSave(statusOverride)` always writes the override to
`payload.status`, regardless of what `type.status.column` is. The generic write path already
maps `status` to the right storage column server-side (`mapFieldsToColumns`/the content adapter),
so the client never needs to know the column name.

**`capabilities.publish` falls back to `capabilities.write`** when unset — the same
"no capability declared means open" rule every other capability check in this project follows.
Never call `can('')` as a stand-in for "no capability declared":

```ts
const canPublish = computed(() => {
  const cap = contentType.value?.capabilities?.publish ?? contentType.value?.capabilities?.write
  return !cap || can(cap)
})
```

`mapColumnsToFields` returns `item.status` symmetrically with the write side: when
`type.status` is set, it reads the status column (`type.status.column`, default `'status'`) back
off the stored row, the same column `@plutocms/supabase`'s `content-adapter.ts` already writes
to on create/update. Without this, the generic form would send a status value on save but never
read one back, and `PlutoContentForm`'s Save/Publish/Update button logic — which depends on
reading the current status from the loaded item — would never see anything but the default.

## The `contentActions` registry bucket

A layer adds its own button to the generic content form's toolbar (or aside) without a bespoke
form component, the same way it adds a nav item or a dashboard widget — through
`definePlutoExtension`:

```ts
definePlutoExtension({
  id: 'supabase-shop',
  contentActions: [
    {
      id: 'sync-inventory',
      contentType: 'product',
      label: 'Sync inventory',
      icon: 'lucide:refresh-cw',
      placement: 'toolbar',
      show: (ctx) => ctx.editing,
      onSelect: async (ctx) => {
        await someInventorySync(ctx.item)
      },
    },
  ],
})
```

Match rule: `contentType` is either an exact content-type `name`, or `'*'` for every content
type — the same rule `PlutoContentFieldWidget` uses for field type. `placement` defaults to
`'toolbar'`.

`usePlutoContentActions(typeName, placement)` returns the matching, ordered action list as a
computed:

```ts
const toolbarActions = usePlutoContentActions('product', 'toolbar')
```

`show?: (ctx) => boolean` gates visibility per render — omit it to always show the action.
`onSelect(ctx)` receives a `PlutoContentActionContext`:

```ts
interface PlutoContentActionContext {
  type: PlutoContentType
  item: Record<string, unknown>
  editing: boolean
  saving: boolean
  save: () => Promise<void>
  remove: () => Promise<void>
}
```

`save` and `remove` call the form's own save/delete logic (including its confirm-delete modal),
so a registered action never re-implements either. There is no dedicated
`PlutoContentActions.vue` wrapper component — `PlutoContentForm` calls
`usePlutoContentActions` directly and renders the result as plain `UButton`s. A wrapper is not
worth adding while `PlutoContentForm` is the only consumer; revisit if a second one appears.

## The `contentToolbarItems` registry bucket

A layer adds a component (a status, an indicator) to the toolbar of the generic content form. The
toolbar renders it before the buttons, after the "View" link. The component gets no props. It
renders inside the form, so it calls `usePlutoContentForm()` to read the item and to run code
after a save (`onSaved`). The entry follows the rules of the other component buckets: register it
with `defineAsyncComponent` (dev warns about a sync component).

```ts
definePlutoExtension({
  id: 'pluto-github',
  contentToolbarItems: [
    {
      id: 'build-status',
      contentType: '*', // a content type `name`, or '*' for every type
      order: 50,
      enabled: () => true,
      component: defineAsyncComponent(() => import('./BuildStatus.vue')),
    },
  ],
})
```

`usePlutoContentToolbarItems(typeName)` returns the matching entries as a computed (the same match
rule as `usePlutoContentActions`; the registry sorts by `order`). `PlutoContentForm` passes the list
to `PlutoContentFormHeader` in the `toolbarItems` prop. The component must show nothing when it has
nothing to say, because the item has no `show` test. The GitHub CMS uses this for its build status
(see the github-cms skill). Tests: `test/content-toolbar-items.test.ts`.

## Known limits, out of scope for this pass

- No per-layer adoption of the publish workflow yet. A content type declares `status` and gets
  the workflow for free, but no shipped content type in this repo declares one yet — that is a
  backend layer's job, in a later wave.
- `contentActions` has no built-in ordering field beyond `PlutoEntry.order` (inherited, same as
  every other registry bucket) — a layer that needs a specific position among several actions
  sets `order` explicitly.
