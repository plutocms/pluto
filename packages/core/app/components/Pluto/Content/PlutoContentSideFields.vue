<script setup lang="ts">
import type {
  PlutoContentSideGroup,
  PlutoField,
} from '../../../../shared/types/content'
import { plutoSideFieldLayout } from '../../../../shared/utils/content-side-groups'

const props = defineProps<{
  fields: PlutoField[]
  groups?: PlutoContentSideGroup[]
  item: Record<string, unknown>
  type: string
  disabled?: boolean
  pending?: boolean
}>()

const emit = defineEmits<{
  update: [field: PlutoField, value: unknown]
}>()

const { tx } = usePlutoI18n()

const layout = computed(() => plutoSideFieldLayout(props.fields, props.groups))

const open = reactive<Record<string, boolean>>({})

function isOpen(group: PlutoContentSideGroup) {
  return open[group.id] ?? group.defaultOpen ?? true
}
</script>

<template>
  <template v-if="pending">
    <PlutoSkeletonField
      v-for="field in layout.loose"
      :key="field.name"
      :field="field"
    />
  </template>

  <template v-else>
    <PlutoContentField
      v-for="field in layout.loose"
      :key="field.name"
      :type="type"
      :field="field"
      :model-value="item[field.name]"
      :disabled="disabled"
      @update:model-value="emit('update', field, $event)"
    />
  </template>

  <UCollapsible
    v-for="{ group, fields: groupFields } in layout.groups"
    :key="group.id"
    :open="isOpen(group)"
    :unmount-on-hide="false"
    class="border-default -mx-1 border-t pt-3"
    @update:open="open[group.id] = $event"
  >
    <UButton
      :label="tx(group.label)"
      :icon="group.icon"
      color="neutral"
      variant="ghost"
      class="text-highlighted bg-pluto-frame sticky -top-4 z-10 w-full rounded-none px-1 font-semibold"
    >
      <template #trailing>
        <UIcon
          :class="isOpen(group) ? 'rotate-180' : ''"
          name="lucide:chevron-down"
          class="text-dimmed ms-auto size-4 transition-transform duration-200"
        />
      </template>
    </UButton>

    <template #content>
      <div class="flex flex-col gap-6 px-1 pt-3 pb-1">
        <template v-if="pending">
          <PlutoSkeletonField
            v-for="field in groupFields"
            :key="field.name"
            :field="field"
          />
        </template>

        <template v-else>
          <PlutoContentField
            v-for="field in groupFields"
            :key="field.name"
            :type="type"
            :field="field"
            :model-value="item[field.name]"
            :disabled="disabled"
            @update:model-value="emit('update', field, $event)"
          />
        </template>
      </div>
    </template>
  </UCollapsible>
</template>
