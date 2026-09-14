# Admin view chrome

This feature gives one page in the admin area a consistent shell: a toolbar row, a scrollable
main area, and an optional right-hand aside. `PlutoContentList` and `PlutoContentForm` both use
it. It also adds the publish workflow to the generic content form, and a registry bucket that
lets a layer add its own buttons to that form.

It extends the [content model](../content-model/SKILL.md). Read that skill file first. This
feature adds:

- `app/components/Pluto/View/PlutoAdminPanel.vue`, `PlutoViewToolbar.vue`, `PlutoViewAside.vue`
  — the three per-view chrome primitives described below.
- `PlutoContentType.form` on `shared/types/content.ts` — layout knobs for the generic form.
- `PlutoContentTypeCapabilities.publish` on `shared/types/content.ts` — the publish capability.
- `PlutoContentAction`/`PlutoContentActionContext` on `shared/types/registry.ts`, a
  `contentActions` field on `PlutoExtension`, and a `contentActions` bucket on `PlutoRegistry`.
- `app/composables/pluto-content-actions.ts` — `usePlutoContentActions(typeName, placement)`.
- `shared/utils/content-map.ts` (extended) — `mapColumnsToFields` now also returns `item.status`.
- `PlutoContentList.vue` and `PlutoContentForm.vue` (rewired) — both now render inside
  `PlutoAdminPanel`, and `PlutoContentForm` adds the publish workflow UI.
- `test/content-actions.test.ts` — unit tests for `usePlutoContentActions`.

## Three chrome primitives, not the global layout

Do not confuse these with `app/layouts/admin.vue` or `PlutoNavbarAdmin.vue`. Those two are
**app-level, one per admin session**: the layout owns the left sidebar and the page frame, and
`PlutoNavbarAdmin` is the single global top bar registered through `PlutoNavbarShell`. A page's
own content renders inside the layout's body slot.

`PlutoAdminPanel`, `PlutoViewToolbar`, and `PlutoViewAside` are **per-view, one set per page**.
They give one page (a content list, a content form, or any other admin page) its own local
toolbar and optional aside, inside the space the global layout already gives it.

### `PlutoAdminPanel`

The outer shell for one view. Props:

- `width?: 'container' | 'full'` — default `'container'`. `'container'` wraps the main slot in a
  max-width `UContainer`. `'full'` drops that wrap, for a view that wants to use the whole width
  (a writing surface, a media grid).

Slots:

- `#toolbar` — a shrink-to-fit row pinned above the scrollable area. Put a `PlutoViewToolbar`
  here.
- default — the scrollable main content.
- `#aside` — a shrink-to-fit column beside the main content. Put a `PlutoViewAside` here. Leave
  this slot empty on a view with nothing to show beside the main content — an empty aside slot
  renders as a zero-width wrapper, so it costs nothing to leave unused.

### `PlutoViewToolbar`

One row of controls for a view: a back button, a title, and left/right button groups. Wraps
Nuxt UI's `UDashboardNavbar` with one fix — `:toggle="false"` — because the vendor default
toggle button controls the app-level LEFT sidebar through a global hook. A second, page-local
toolbar must never render that button, or it would open and close the wrong sidebar.

Props: `title?: string`, `icon?: string`, `backTo?: string` (renders a back arrow button before
the title).

Slots: `#left` (replaces the whole leading area — icon, title, and trailing content — so only use
it when you also want to replace the title), `#title`, default (a centered slot), `#right`,
`#trailing` (renders right after the title, inside the same leading area — the natural place for
a small button that belongs next to the title, like a refresh button).

### `PlutoViewAside`

A right-hand panel bound to an `open` model (`v-model:open`). On a wide screen it renders as a
plain `<aside>` beside the main content. On a narrow screen it renders as a `USlideover`
instead — the same content, two different presentations, picked by CSS breakpoint, not by
JavaScript. Props: `title?: string`, `width?: number` (desktop width in px, default 320).

Like `PlutoViewToolbar`, this is a hand-built stand-in rather than Nuxt UI's own
`UDashboardSidebar`, for the same reason: `UDashboardSidebar` listens to a global toggle hook,
and a second instance of it here would fight the app-level sidebar for that hook.

## `PlutoContentType.form` — form layout knobs

```ts
form?: {
  /** 'default' = heading + container. 'focus' = minimal chrome for a writing surface. */
  layout?: 'default' | 'focus'
  /** true = always show. false = never. 'auto' (default) = show when any field has region 'side'. */
  aside?: boolean | 'auto'
  /** Aside starts closed. Default false, or true when layout is 'focus'. */
  asideCollapsed?: boolean
  /** Drop the max-width container in the main region. Default false, or true when layout is 'focus'. */
  width?: 'container' | 'full'
}
```

`PlutoContentForm` reads all four. `layout: 'focus'` drops the page heading and moves the
type's label into the toolbar title instead, and defaults the aside to collapsed — the shape a
long-form writing surface wants. Leave `form` unset for the default two-column form every other
content type already gets.

The aside's open/closed state persists per content type, in a cookie keyed
`pluto-content-aside-<typeName>`, so a user's choice survives a page reload.

## The publish workflow

A content type opts into a draft/published workflow by setting `status` (see the content-model
skill for the full `PlutoContentStatus` shape: `values`, `default`, `publishedValue`,
`publishedAtColumn`, `column`). `PlutoContentForm` reads `type.status` to decide what to show:

- No `status` declared (`status` unset or `false`) — one plain "Save" button. Byte-identical to
  a content type with no publish workflow at all; `onSave()` is called with no argument.
- `status` declared, current value is not `publishedValue` — a "Save draft" button plus a
  "Publish" button. Publish calls `onSave(publishedValue)`.
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

## Known limits, out of scope for this pass

- No per-layer adoption of the publish workflow yet. A content type declares `status` and gets
  the workflow for free, but no shipped content type in this repo declares one yet — that is a
  backend layer's job, in a later wave.
- `contentActions` has no built-in ordering field beyond `PlutoEntry.order` (inherited, same as
  every other registry bucket) — a layer that needs a specific position among several actions
  sets `order` explicitly.
