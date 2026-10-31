<script setup lang="ts">
// The right panel (the Block tab): the controls of the selected block. A Text
// block has a rich text box. A Code block has a language, a file name and a
// code box. A component has its content (one control for each slot) and its
// settings. Unknown settings are in the Advanced section. Nothing here shows
// raw keys or YAML, except in Advanced and in "Edit as Markdown".
import type {
  PlutoBlock,
  PlutoComponentBlock,
  PlutoPropValue,
} from '../../../../../shared/utils/blocks/types'
import {
  resolveSlotMode,
  slotMarkdown,
} from '../../../../../shared/utils/blocks/editor'
import { blockMarkdown } from '../../../../../shared/utils/blocks/operations'
import PlutoBlockPropControl from './PlutoBlockPropControl.vue'
import PlutoBlockRawEditor from './PlutoBlockRawEditor.vue'
import PlutoBlockTextEditor from './PlutoBlockTextEditor.vue'

defineProps<{
  disabled?: boolean
}>()

const editor = usePlutoBlockEditor()
const { t, tx } = usePlutoI18n()
const { slotLabel, addLabel } = usePlutoBlockLabels()

const block = computed(() => editor.selected.value?.block)
const info = computed(() =>
  block.value ? editor.describe(block.value) : undefined
)
const definition = computed(() =>
  block.value ? editor.definitionOf(block.value) : undefined
)
const parent = computed(() => editor.selected.value?.parent)

// "Edit as Markdown" shows the Markdown of the block in a box. It resets with the selection.
const rawOpen = ref(false)
watch(
  () => block.value?.id,
  () => {
    rawOpen.value = false
  }
)

const description = computed(() => {
  const text = definition.value?.description
  return text ? tx(text) : undefined
})

const LANGUAGES = [
  'bash',
  'css',
  'diff',
  'html',
  'js',
  'json',
  'md',
  'sh',
  'sql',
  'ts',
  'tsx',
  'vue',
  'yaml',
]

// --- Component settings ---------------------------------------------------------

const settings = computed(() => {
  const props = definition.value?.props ?? {}
  return Object.entries(props).filter(([, prop]) => !prop.advanced)
})

const advanced = computed(() => {
  const props = definition.value?.props ?? {}
  return Object.entries(props).filter(([, prop]) => prop.advanced)
})

// A prop with a `slot` (the label of a button) is one field for the prop and the slot. The slot
// does not show in Content.
const coveredSlots = computed(
  () =>
    new Set(
      Object.values(definition.value?.props ?? {}).flatMap((prop) =>
        prop.slot ? [prop.slot] : []
      )
    )
)

// The field edits the slot when the block has text in it, else the prop. It is chosen when the
// block is selected, so clearing the field does not move the text to the other place while typing.
const slotBacked = ref(new Set<string>())
watch(
  () => block.value?.id,
  () => {
    const current = block.value
    slotBacked.value = new Set(
      current?.kind === 'component'
        ? Object.entries(definition.value?.props ?? {}).flatMap(
            ([name, prop]) =>
              prop.slot && slotMarkdown(current, prop.slot).trim() ? [name] : []
          )
        : []
    )
  },
  { immediate: true }
)

function propValue(name: string): PlutoPropValue | undefined {
  const slot = definition.value?.props?.[name]?.slot
  return slot && slotBacked.value.has(name)
    ? slotMarkdown(component(), slot)
    : component().props[name]
}

function setPropValue(name: string, value: PlutoPropValue) {
  const slot = definition.value?.props?.[name]?.slot
  if (slot && slotBacked.value.has(name)) {
    editor.setSlot(component().id, slot, String(value ?? ''))
  } else {
    editor.setProp(component().id, name, value)
  }
}

const slots = computed(() => {
  const current = block.value
  if (current?.kind !== 'component') {
    return []
  }
  return Object.entries(definition.value?.slots ?? {})
    .filter(([name]) => !coveredSlots.value.has(name))
    .map(([name, slot]) => ({
      name,
      label: slotLabel(definition.value, name),
      add: addLabel(definition.value, name),
      mode: resolveSlotMode(
        current,
        name,
        slot.content === 'rich' ||
          slot.content === 'inline' ||
          slot.content === 'blocks'
          ? slot.content
          : undefined
      ),
      children: current.slots[name] ?? [],
      accepts: slot.accepts,
    }))
})

function component(): PlutoComponentBlock {
  return block.value as PlutoComponentBlock
}

function childInfo(child: PlutoBlock) {
  const described = editor.describe(child)
  return { ...described, label: tx(described.label) }
}

function addTo(name: string) {
  editor.openPalette({
    parentId: component().id,
    slot: name,
    index: (component().slots[name] ?? []).length,
  })
}

function rawMarkdown(): string {
  return block.value ? blockMarkdown(block.value) : ''
}

function applyRaw(markdown: string) {
  if (!block.value) {
    return
  }
  if (block.value.kind === 'raw' || block.value.kind === 'text') {
    editor.updateText(block.value.id, markdown)
  } else {
    editor.replaceMarkdown(block.value.id, markdown)
    rawOpen.value = false
  }
}
</script>

<template>
  <div
    :aria-label="t('docs.editor.blockPanel')"
    class="flex flex-col gap-5"
    role="region"
    data-pluto-block-ui
  >
    <UEmpty
      v-if="!block || !info"
      :title="t('docs.editor.nothingSelectedTitle')"
      :description="t('docs.editor.nothingSelected')"
      :actions="[
        {
          label: t('docs.editor.addBlock'),
          icon: 'i-lucide-plus',
          color: 'primary',
          variant: 'soft',
          onClick: () => editor.openPalette(),
        },
      ]"
      icon="i-lucide-mouse-pointer-click"
      variant="naked"
    />

    <template v-else>
      <header class="flex items-start gap-3">
        <span
          class="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary"
        >
          <UIcon :name="info.icon" class="size-5" />
        </span>
        <div class="min-w-0 flex-1">
          <h3 class="truncate text-base font-semibold text-highlighted">
            {{ tx(info.label) }}
          </h3>
          <p v-if="description" class="text-sm text-muted">
            {{ description }}
          </p>
        </div>
      </header>

      <UButton
        v-if="parent"
        :label="
          t('docs.editor.selectParent', {
            name: tx(editor.describe(parent).label),
          })
        "
        icon="i-lucide-corner-left-up"
        color="neutral"
        variant="link"
        size="xs"
        class="-mt-3 self-start p-0"
        @click="editor.select(parent.id)"
      />

      <!-- Edit as Markdown -->
      <section v-if="rawOpen" class="flex flex-col gap-2">
        <p class="text-sm text-muted">
          {{ t('docs.editor.rawNote') }}
        </p>
        <PlutoBlockRawEditor
          :model-value="rawMarkdown()"
          :disabled="disabled"
          :label="t('docs.editor.rawLabel')"
          :live="block.kind === 'text' || block.kind === 'raw'"
          :rows="block.kind === 'component' ? 10 : 8"
          @update:model-value="applyRaw"
        />
      </section>

      <!-- Text -->
      <template v-else-if="block.kind === 'text'">
        <PlutoBlockTextEditor
          :key="block.id"
          :model-value="block.markdown"
          :disabled="disabled"
          :label="t('docs.editor.textLabel')"
          @update:model-value="editor.updateText(block.id, $event)"
        />
      </template>

      <!-- Code -->
      <template v-else-if="block.kind === 'code'">
        <div class="grid grid-cols-2 gap-3">
          <UFormField
            :label="t('docs.editor.language')"
            :help="t('docs.editor.languageHelp')"
          >
            <UInput
              :model-value="block.lang"
              :disabled="disabled"
              list="pluto-block-languages"
              placeholder="ts"
              autocomplete="off"
              spellcheck="false"
              class="w-full"
              @update:model-value="
                editor.updateCode(block.id, { lang: String($event ?? '') })
              "
            />
            <datalist id="pluto-block-languages">
              <option
                v-for="language in LANGUAGES"
                :key="language"
                :value="language"
              />
            </datalist>
          </UFormField>
          <UFormField
            :label="t('docs.editor.fileName')"
            :help="t('docs.editor.fileNameHelp')"
          >
            <UInput
              :model-value="block.filename ?? ''"
              :disabled="disabled"
              placeholder="app.ts"
              autocomplete="off"
              spellcheck="false"
              class="w-full"
              @update:model-value="
                editor.updateCode(block.id, {
                  filename: String($event ?? '') || undefined,
                })
              "
            />
          </UFormField>
        </div>
        <UFormField :label="t('docs.editor.code')">
          <UTextarea
            :model-value="block.code"
            :disabled="disabled"
            :rows="10"
            :maxrows="28"
            :ui="{ base: 'font-mono text-sm/6' }"
            spellcheck="false"
            autocomplete="off"
            autocapitalize="off"
            class="w-full"
            autoresize
            @update:model-value="
              editor.updateCode(block.id, { code: String($event ?? '') })
            "
          />
        </UFormField>
      </template>

      <!-- Markdown (raw) -->
      <template v-else-if="block.kind === 'raw'">
        <UAlert
          :description="
            block.reason === 'table'
              ? t('docs.editor.tableNote')
              : t('docs.editor.rawBlockNote')
          "
          color="neutral"
          variant="subtle"
          icon="i-lucide-info"
        />
        <PlutoBlockRawEditor
          :model-value="block.markdown"
          :disabled="disabled"
          :label="t('docs.editor.rawLabel')"
          :rows="12"
          live
          @update:model-value="editor.updateText(block.id, $event)"
        />
      </template>

      <!-- Component -->
      <template v-else>
        <section v-if="slots.length" class="flex flex-col gap-4">
          <h4 class="text-xs font-semibold uppercase tracking-wide text-muted">
            {{ t('docs.editor.content') }}
          </h4>

          <UFormField
            v-for="slot in slots"
            :key="slot.name"
            :label="slots.length > 1 ? slot.label : undefined"
          >
            <PlutoBlockTextEditor
              v-if="slot.mode === 'rich'"
              :model-value="slotMarkdown(component(), slot.name)"
              :disabled="disabled"
              :label="slot.label"
              compact
              @update:model-value="editor.setSlot(block.id, slot.name, $event)"
            />

            <UInput
              v-else-if="slot.mode === 'inline'"
              :model-value="slotMarkdown(component(), slot.name)"
              :disabled="disabled"
              :aria-label="slot.label"
              class="w-full"
              @update:model-value="
                editor.setSlot(block.id, slot.name, String($event ?? ''))
              "
            />

            <PlutoBlockRawEditor
              v-else-if="slot.mode === 'markdown'"
              :model-value="slotMarkdown(component(), slot.name)"
              :disabled="disabled"
              :label="slot.label"
              :rows="5"
              live
              @update:model-value="editor.setSlot(block.id, slot.name, $event)"
            />

            <div v-else class="flex flex-col gap-1">
              <ul v-if="slot.children.length" class="flex flex-col gap-1">
                <li v-for="child in slot.children" :key="child.id">
                  <button
                    type="button"
                    class="flex w-full items-center gap-2 rounded-md border border-default px-2 py-1.5 text-start text-sm hover:bg-elevated focus-visible:outline-2 focus-visible:outline-primary"
                    @click="editor.select(child.id)"
                  >
                    <UIcon
                      :name="childInfo(child).icon"
                      class="size-4 shrink-0 text-muted"
                    />
                    <span class="min-w-0 flex-1 truncate">
                      <span class="font-medium text-highlighted">{{
                        childInfo(child).label
                      }}</span>
                      <span v-if="childInfo(child).excerpt" class="text-muted"
                        >: {{ childInfo(child).excerpt }}</span
                      >
                    </span>
                    <UIcon
                      name="i-lucide-chevron-right"
                      class="size-4 shrink-0 text-dimmed"
                    />
                  </button>
                </li>
              </ul>
              <p v-else class="text-sm text-muted">
                {{ t('docs.editor.slotEmpty') }}
              </p>
              <UButton
                :label="slot.add"
                :disabled="disabled"
                icon="i-lucide-plus"
                color="neutral"
                variant="outline"
                size="xs"
                class="self-start"
                @click="addTo(slot.name)"
              />
            </div>
          </UFormField>
        </section>

        <section v-if="settings.length" class="flex flex-col gap-4">
          <h4 class="text-xs font-semibold uppercase tracking-wide text-muted">
            {{ t('docs.editor.settings') }}
          </h4>
          <PlutoBlockPropControl
            v-for="[name, prop] in settings"
            :key="name"
            :name="name"
            :definition="prop"
            :model-value="propValue(name)"
            :disabled="disabled"
            @update:model-value="setPropValue(name, $event)"
          />
        </section>

        <details
          v-if="advanced.length"
          class="group rounded-lg border border-default"
        >
          <summary
            class="flex cursor-pointer list-none items-center gap-2 px-3 py-2 text-sm font-medium text-highlighted focus-visible:outline-2 focus-visible:outline-primary"
          >
            <UIcon
              name="i-lucide-chevron-right"
              class="size-4 text-muted transition-transform group-open:rotate-90"
            />
            {{ t('docs.editor.advanced') }}
          </summary>
          <div class="flex flex-col gap-4 border-t border-default p-3">
            <PlutoBlockPropControl
              v-for="[name, prop] in advanced"
              :key="name"
              :name="name"
              :definition="prop"
              :model-value="component().props[name]"
              :disabled="disabled"
              @update:model-value="editor.setProp(block.id, name, $event)"
            />
          </div>
        </details>
      </template>

      <!-- Actions -->
      <div class="flex flex-wrap gap-2 border-t border-default pt-4">
        <UButton
          :label="t('docs.editor.duplicate')"
          :disabled="disabled"
          icon="i-lucide-copy"
          color="neutral"
          variant="outline"
          size="sm"
          @click="editor.duplicate(block.id)"
        />
        <UButton
          :label="
            rawOpen
              ? t('docs.editor.backToControls')
              : t('docs.editor.editAsMarkdown')
          "
          :icon="rawOpen ? 'i-lucide-sliders-horizontal' : 'i-lucide-file-code'"
          :disabled="disabled || block.kind === 'raw'"
          color="neutral"
          variant="outline"
          size="sm"
          @click="rawOpen = !rawOpen"
        />
        <UButton
          :label="t('docs.editor.delete')"
          :disabled="disabled"
          icon="i-lucide-trash-2"
          color="error"
          variant="soft"
          size="sm"
          class="ms-auto"
          @click="editor.remove(block.id)"
        />
      </div>
    </template>
  </div>
</template>
