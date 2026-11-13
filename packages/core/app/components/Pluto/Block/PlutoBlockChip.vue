<script setup lang="ts">
import type { NodeViewProps } from '@tiptap/vue-3'
import type { PlutoMedia } from '../../../../shared/types/media'
import type {
  PlutoBlockPropDefinition,
  PlutoPropValue,
} from '../../../../shared/utils/blocks/definition'
import { NodeViewWrapper } from '@tiptap/vue-3'
import { camelKey } from '#layers/pluto/shared/utils/blocks/definition'
import PlutoBlockPropControl from './PlutoBlockPropControl.vue'

const props = defineProps<NodeViewProps>()

const { t, tx } = usePlutoI18n()

const info = computed(() =>
  plutoContentComponentInfo(String(props.node.attrs.name ?? ''))
)
const label = computed(() => tx(info.value.label))
const description = computed(() =>
  info.value.description ? tx(info.value.description) : undefined
)
const values = computed<Record<string, PlutoPropValue>>(
  () => props.node.attrs.props ?? {}
)
const editable = computed(() => props.editor.isEditable)

function fieldFromValue(value: unknown): PlutoBlockPropDefinition {
  if (typeof value === 'boolean') {
    return { type: 'boolean' }
  }
  if (typeof value === 'number') {
    return { type: 'number' }
  }
  return {
    type: typeof value === 'string' && value.includes('\n') ? 'text' : 'string',
  }
}

const fields = computed(() => {
  const keys = Object.keys(values.value)
  const out: Array<{ name: string; definition: PlutoBlockPropDefinition }> = []
  for (const [prop, definition] of Object.entries(info.value.props)) {
    const name =
      keys.find((key) => key === prop) ??
      keys.find((key) => camelKey(key) === camelKey(prop)) ??
      prop
    out.push({ name, definition })
  }
  for (const key of keys) {
    if (!out.some((field) => field.name === key)) {
      out.push({ name: key, definition: fieldFromValue(values.value[key]) })
    }
  }
  return out
})

const summary = computed(() =>
  fields.value
    .map((field) => values.value[field.name])
    .filter(
      (value): value is string => typeof value === 'string' && value !== ''
    )
    .slice(0, 2)
    .join(' · ')
)

const open = ref(false)
const iconEl = useTemplateRef<HTMLElement>('icon')
onMounted(() => {
  if (takePlutoContentComponentOpen() && editable.value) {
    requestAnimationFrame(() => {
      open.value = true
    })
  }
})

function setProps(patch: Record<string, PlutoPropValue>) {
  const next = { ...values.value }
  for (const [name, value] of Object.entries(patch)) {
    if (value === undefined) {
      delete next[name]
    } else {
      next[name] = value
    }
  }
  props.updateAttributes({ props: next })
}

function setMedia(
  name: string,
  definition: PlutoBlockPropDefinition,
  media: PlutoMedia
) {
  const patch: Record<string, PlutoPropValue> = { [name]: media.url }
  const fills = definition.fills ?? {}
  if (fills.width && media.width) {
    patch[fills.width] = media.width
  }
  if (fills.height && media.height) {
    patch[fills.height] = media.height
  }
  if (fills.alt && media.alt && !values.value[fills.alt]) {
    patch[fills.alt] = media.alt
  }
  setProps(patch)
}

function remove() {
  open.value = false
  props.deleteNode()
}
</script>

<template>
  <NodeViewWrapper
    :data-pluto-component="node.attrs.name"
    class="pluto-block-chip my-3"
  >
    <UPopover
      v-model:open="open"
      :content="{ align: 'start', side: 'bottom', sideOffset: 15 }"
      :reference="iconEl ?? undefined"
      arrow
    >
      <button
        :aria-label="t('pluto.blocks.chipLabel', { name: label })"
        :class="
          selected
            ? 'border-primary ring-primary ring-1'
            : 'border-default hover:border-accented'
        "
        type="button"
        class="bg-elevated/60 flex w-full max-w-full items-center gap-3 rounded-lg border px-3 py-2 text-start text-sm transition-colors"
      >
        <span
          ref="icon"
          class="bg-primary/10 text-primary flex size-8 shrink-0 items-center justify-center rounded-md"
        >
          <UIcon :name="info.icon" class="size-4" />
        </span>
        <span class="min-w-0 flex-1">
          <span class="text-highlighted block truncate font-medium">
            {{ label }}
          </span>
          <span v-if="summary" class="text-muted block truncate text-xs">
            {{ summary }}
          </span>
        </span>
        <UBadge
          v-if="!info.known"
          :label="t('pluto.blocks.unknown')"
          color="warning"
          variant="subtle"
          size="sm"
        />
        <UIcon name="i-lucide-settings-2" class="text-dimmed size-4 shrink-0" />
      </button>

      <template #content>
        <div class="w-80 max-w-[calc(100vw-2rem)] space-y-3 p-3">
          <div class="space-y-1">
            <p class="text-highlighted flex items-center gap-2 font-medium">
              <UIcon :name="info.icon" class="text-primary size-4" />
              {{ label }}
            </p>
            <p v-if="description" class="text-muted text-xs">
              {{ description }}
            </p>
            <p v-if="!info.known" class="text-warning text-xs">
              {{ t('pluto.blocks.unknownHelp', { name: node.attrs.name }) }}
            </p>
          </div>
          <p v-if="fields.length === 0" class="text-muted text-sm">
            {{ t('pluto.blocks.noProps') }}
          </p>
          <PlutoBlockPropControl
            v-for="field in fields"
            :key="field.name"
            :name="field.name"
            :definition="field.definition"
            :model-value="values[field.name]"
            :disabled="!editable"
            @update:model-value="setProps({ [field.name]: $event })"
            @media="setMedia(field.name, field.definition, $event)"
          />
          <div
            v-if="editable"
            class="border-default flex justify-end border-t pt-3"
          >
            <UButton
              :label="t('pluto.blocks.remove')"
              icon="i-lucide-trash-2"
              color="error"
              variant="ghost"
              size="sm"
              @click="remove"
            />
          </div>
        </div>
      </template>
    </UPopover>
  </NodeViewWrapper>
</template>
