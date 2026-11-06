<script setup lang="ts">
// The list of changed fields, shared by History and the backup recovery. A short value shows as
// two rows (before and after). A long or multi-line text shows as a folded line diff. The caller
// builds `changes` with `diffFields`. See the content-model skill ("Revisions").

const props = defineProps<{
  type: PlutoContentType | undefined
  changes: PlutoFieldChange[]
  /** The label of the value in the form (the removed rows). */
  beforeLabel: string
  /** The label of the other value (the added rows). */
  afterLabel: string
}>()

const { t } = usePlutoI18n()
const text = usePlutoContentText(() => props.type)
</script>

<template>
  <div class="flex flex-col gap-5">
    <section
      v-for="change in changes"
      :key="change.field.name"
      class="flex flex-col gap-1.5"
    >
      <h3 class="text-highlighted text-sm font-medium">
        {{ text.fieldLabel(change.field) }}
      </h3>

      <dl
        v-if="change.kind === 'value'"
        class="border-default divide-default divide-y overflow-hidden rounded-md border text-sm"
      >
        <div class="bg-error/5 flex gap-3 px-3 py-2">
          <dt class="text-muted w-24 shrink-0 text-xs/5">
            {{ beforeLabel }}
          </dt>
          <dd class="text-default min-w-0 wrap-break-word">
            {{ change.before || t('pluto.history.empty') }}
          </dd>
        </div>
        <div class="bg-success/5 flex gap-3 px-3 py-2">
          <dt class="text-muted w-24 shrink-0 text-xs/5">
            {{ afterLabel }}
          </dt>
          <dd class="text-highlighted min-w-0 wrap-break-word">
            {{ change.after || t('pluto.history.empty') }}
          </dd>
        </div>
      </dl>

      <div
        v-else
        class="border-default overflow-x-auto rounded-md border font-mono text-xs/5"
      >
        <template v-for="(row, index) in foldDiff(change.lines)" :key="index">
          <div
            v-if="row.kind === 'skip'"
            class="bg-elevated/50 text-muted px-3 py-0.5 font-sans"
          >
            {{ t('pluto.history.hiddenLines', row.count) }}
          </div>
          <div
            v-else
            :class="
              row.kind === 'add'
                ? 'bg-success/10 text-highlighted'
                : row.kind === 'remove'
                  ? 'bg-error/10 text-default'
                  : 'text-muted'
            "
            class="flex min-w-max"
          >
            <span
              class="w-6 shrink-0 text-center select-none"
              aria-hidden="true"
              >{{
                row.kind === 'add' ? '+' : row.kind === 'remove' ? '−' : ''
              }}</span
            >
            <span class="sr-only">{{
              row.kind === 'add'
                ? afterLabel
                : row.kind === 'remove'
                  ? beforeLabel
                  : ''
            }}</span>
            <span class="pe-3 whitespace-pre">{{ row.text || ' ' }}</span>
          </div>
        </template>
      </div>
    </section>
  </div>
</template>
