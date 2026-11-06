# Content backup

The admin content form keeps a backup of the unsaved changes in the browser. A crash, a closed
tab or a failed save does not lose the work. When the user opens the item again, the form offers
to restore the changes. The plan is `.claude/plan/autosave.md` of the workspace.

This skill covers the browser backup and the recovery UI. It builds on the
[admin view chrome](../admin-view-chrome/SKILL.md) ("Unsaved changes", "The form context") and the
[content model](../content-model/SKILL.md).

## What it is, and what it is not

- A **backup**, not an autosave. The Save and Publish buttons stay the only writes of content. A
  backup never touches the backend: no commit, no revision, no deploy, no live text.
- The word in code and UI is "backup". The form already has "Save draft" and a "Draft" status, so
  "draft" would mix with them.
- It works the same on every backend. It needs no adapter change.

## The record

One `localStorage` entry for each app base path, user, type and item:
`'pluto:backup:' + JSON.stringify([baseURL, userId, type, id ?? null])`. A new item has the id
`null`. `baseURL` is `useRuntimeConfig().app.baseURL`.

```ts
interface PlutoContentBackup {
  v: 1
  savedAt: number // ms, the time of the last change (browser clock)
  device: string // the id of this browser (`pluto:device`, kept after sign-out)
  tab: string // a random id for each form mount
  version?: string // the `_version` of the item at the baseline
  slugTouched?: boolean // new item: the user typed in the slug field
  changes: Record<string, { base?: unknown; value?: unknown }>
}
```

`changes` holds only the fields that differ from the baseline: `base` is the baseline value and
`value` is the form value. The backup fields are the declared fields with `inForm !== false`,
except the status field (`backupFields`). Virtual fields and the slug are in. The record has no
`_version`, `_frontmatter`, id or timestamps.

## Files

- `shared/utils/content-backup.ts` (pure, no Nuxt imports): the record type, `backupFields`,
  `backupChanges`, `parseBackup`, `planRestore`, `pickBackup`, `keepaliveBody`, and the limits
  (`PLUTO_BACKUP_*`). `pickBackup` and `keepaliveBody` are for the server copy: the form does not
  use them yet.
- `shared/utils/stable-stringify.ts`: `stableStringify`, moved out of `content-dirty.ts`. A module
  of `app/composables/internal` cannot import a runtime value from `shared/` (a layer build cannot
  resolve it, pluto#433). Use it by auto-import, or pass it in.
- `app/composables/internal/content-backup-store.ts` (pure): `backupKey`, `isBackupKeyOf`,
  `createBackupStore(storage, limits)`, `createBackupScheduler`, `deviceId`, `clearUserBackups`.
  It takes a `Storage`-like object, timers and the `parse` function as parameters.
- `app/composables/pluto-content-backup.ts`: `usePlutoContentBackup(options)`, the Vue glue.
- `app/components/Pluto/Content/PlutoContentBackupAlert.vue`: the offer.
- `app/components/Pluto/Content/PlutoContentChanges.vue`: the diff list, shared with History.
- `shared/utils/content-revision.ts`: `diffFields(fields, current, next)`.
  `diffRevision` calls it.

Tests (`test/content-backup.test.ts`, `test/content-backup-store.test.ts`) use a fake storage and
fake timers. No DOM, no Nuxt.

## When the form writes

A write needs all of these: the item loaded, the offer decided, the form is dirty, the user can
save, a user id exists, `type.form.backup` is not `false`, the state is `idle`, and the browser did
not refuse a write.

- 1 s after the last change, or every 5 s at most during continuous typing
  (`createBackupScheduler`).
- Synchronously on `pagehide` and on `visibilitychange` to `hidden`.
- Before each write the form runs the `onFlush` callbacks of the widgets, so an editor with a
  debounce writes its text to the item first.
- When the form is not dirty any more (the user undid the change), the backup is removed.

## The states

- `idle`: backups write.
- `offered`: the alert shows. Writes pause, so the old backup stays until the user chooses. The
  state ends on Restore, Discard, a save that worked, and when `planRestore` finds nothing to
  restore (the backup is removed).
- `stopped`: after "Leave without saving", a delete, or a save that navigates (a new item or an id
  change). A stopped form writes nothing, so the unmount flush of an editor cannot write a removed
  backup again.

## The offer

When the item loads (at once for a new item), the form reads the record, drops the fields that the
type does not declare, and runs `planRestore` against the baseline (`JSON.parse(dirtyState.baseline)`,
so it follows the normal form that an editor writes after it mounts).

If a field differs, `PlutoContentBackupAlert` shows above the fields (color `info`, icon
`lucide:life-buoy`):

- Title "Unsaved changes found". Text "Changes from {time} were not saved." The text for a record from
  another device ("Changes from another device, from {time}, were not saved.") is in the locale
  files and in the alert. The form shows it only when a server copy exists (not yet).
- **Restore** sets `slugTouched` (new item), calls `tracker.interact()` (so the baseline stays and
  the form is dirty), puts the backup `value` of each changed field in the form, and shows a toast.
  A field that only the stored item changed keeps the stored value. A field that changed in both
  places (the stored value is not the backup `base`) takes the backup value, and the alert named it
  before: "The item was saved again after that. These fields changed in both places: {fields}."
- **Discard** removes the backup.
- **Show changes** opens a slideover with `PlutoContentChanges` ("Saved" against "Backup"), the
  same diff as History, and the Restore and Discard buttons.

A second alert (warning, closable) shows when another tab wrote the backup of this item (a
`storage` event with another `tab`): "This item has unsaved changes in another tab. The tab that
saves last wins." There is no lock.

## Save, delete, leave

- A save that worked removes the backup of the item (and the `+new` key of a new item). A rename
  removes the key of the old id before the form navigates.
- A failed save keeps the backup.
- A delete that worked removes it.
- "Leave without saving" removes it, so the text of the dialog stays true.
- A tab close or a reload keeps it. That is the recovery case.

## Limits

One backup holds at most 1,000,000 characters of JSON, all backups together at most 2,500,000, so
the other keys of the origin still fit. A larger change is not backed up (a dev-only warning shows).
Each user has at most 20 backups: the oldest `savedAt` goes first. A backup expires after 14 days.
Pruning runs when a form mounts. On a quota error, the store makes room (the expired backups, then
the oldest backup of the user) and tries once more. If the second write fails too, the form stops
backups for the page view, with no message. The store catches every storage error (private mode,
`SecurityError`).

## Sign-out, privacy, opt-out

- `usePlutoAuth().signOut()` reads the user id first. After the driver signs out, it removes every
  backup of that user under this base path (`clearUserBackups`). A session that expires keeps the
  backups, so the same user gets them back after the next sign-in. With no user id, the form reads
  and writes nothing.
- Backups are plain text in the browser profile. The mitigations: a key for each user, removal on
  sign-out, a 14-day expiry, and the opt-out.
- `PlutoContentType.form.backup?: boolean` (default `true`). `false` turns the backups off for the
  type. There is no app-wide switch.
- In development, two apps on `localhost:3000` share `localStorage`. The same user, type and id can
  give an offer from the other app. The user discards it.

## The `server` slot

`usePlutoContentBackup` takes an optional `server` (`read(key)`, `remove(key)`). `PlutoContentForm`
passes none: the browser backup is all there is. A later version fills the slot with a server copy
and uses `pickBackup` and `keepaliveBody`. The key of the server copy is the item id as text, or
`+new`. Do not use the slot for anything else.

## Known limits

- The 409 conflict flow ("Load the latest and keep my changes") is not here yet.
- A widget that holds edits outside its `modelValue` must register `onFlush`
  (`usePlutoContentForm()?.onFlush(...)`). The core widgets need nothing.
- Edits made while the offer shows are not backed up. The leave guard still protects them.
- An item that is gone (404) keeps its backup until it expires. There is no "Create from backup".
