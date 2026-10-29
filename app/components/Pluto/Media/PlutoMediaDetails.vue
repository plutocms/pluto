<script setup lang="ts">
// The details of one file, in the aside of the Media page: a preview, the
// facts of the record, the alt text, copy the URL, delete.
import type { PlutoMedia } from '../../../../shared/types/media'
import { formatMediaSize, mediaKind } from '../../../../shared/utils/media'

const props = defineProps<{ media: PlutoMedia }>()

const emit = defineEmits<{
  updated: [media: PlutoMedia]
  deleted: [id: string]
}>()

const { t, d, locale } = usePlutoI18n()
const errorText = usePlutoErrorText()
const { can } = usePlutoPermissions()
const toast = useToast()
const library = usePlutoMedia()

const alt = ref(props.media.alt)
watch(
  () => props.media,
  (media) => {
    alt.value = media.alt
  }
)

const kind = computed(() => mediaKind(props.media.mimeType))
const href = computed(() =>
  import.meta.client
    ? new URL(props.media.url, window.location.origin).href
    : props.media.url
)

const facts = computed(() =>
  [
    { label: t('pluto.media.details.name'), value: props.media.name },
    { label: t('pluto.media.details.type'), value: props.media.mimeType },
    {
      label: t('pluto.media.details.size'),
      value: formatMediaSize(props.media.size, locale.value),
    },
    {
      label: t('pluto.media.details.pixels'),
      value:
        props.media.width && props.media.height
          ? `${props.media.width} × ${props.media.height}`
          : '',
    },
    {
      label: t('pluto.media.details.date'),
      value: d(new Date(props.media.createdAt), {
        dateStyle: 'medium',
        timeStyle: 'short',
      }),
    },
  ].filter((fact) => fact.value)
)

const saving = ref(false)
async function saveAlt() {
  saving.value = true
  try {
    const record = await library.update(props.media.id, { alt: alt.value })
    emit('updated', record)
    toast.add({
      title: t('pluto.media.details.altSaved'),
      color: 'success',
      icon: 'lucide:check',
    })
  } catch (error) {
    toast.add({
      title: t('pluto.media.errors.saveFailed'),
      description: errorText(error),
      color: 'error',
    })
  } finally {
    saving.value = false
  }
}

const { copy } = useClipboard()
async function copyUrl() {
  await copy(href.value)
  toast.add({
    title: t('pluto.media.details.copied'),
    color: 'success',
    icon: 'lucide:copy',
  })
}

const confirmOpen = ref(false)
const deleting = ref(false)
async function remove() {
  deleting.value = true
  try {
    await library.remove(props.media.id)
    confirmOpen.value = false
    emit('deleted', props.media.id)
    toast.add({
      title: t('pluto.media.details.deleted'),
      color: 'success',
      icon: 'lucide:trash',
    })
  } catch (error) {
    toast.add({
      title: t('pluto.media.errors.deleteFailed'),
      description: errorText(error),
      color: 'error',
    })
  } finally {
    deleting.value = false
  }
}
</script>

<template>
  <UTheme :props="{ button: { size: 'md' } }">
    <div class="flex flex-col gap-5">
      <div
        class="bg-elevated ring-default flex aspect-square items-center justify-center overflow-hidden rounded-lg ring"
      >
        <img
          v-if="kind === 'image'"
          :src="media.url"
          :alt="media.alt"
          class="size-full object-contain"
        />
        <UIcon
          v-else
          :name="
            kind === 'model'
              ? 'lucide:box'
              : kind === 'document'
                ? 'lucide:file-text'
                : 'lucide:file'
          "
          class="text-muted size-12"
        />
      </div>

      <dl class="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-sm">
        <template v-for="fact in facts" :key="fact.label">
          <dt class="text-muted">{{ fact.label }}</dt>
          <dd class="min-w-0 break-all">{{ fact.value }}</dd>
        </template>
      </dl>

      <UFormField
        v-if="kind === 'image'"
        :label="t('pluto.media.details.alt')"
        :description="t('pluto.media.details.altHint')"
      >
        <UTextarea
          v-model="alt"
          :disabled="!can('media:manage')"
          :rows="2"
          :maxlength="500"
          class="w-full"
          autoresize
        />
      </UFormField>

      <div class="flex flex-wrap gap-2">
        <UButton
          v-if="kind === 'image' && can('media:manage')"
          :label="t('pluto.common.save')"
          :loading="saving"
          :disabled="alt === media.alt"
          @click="saveAlt"
        />
        <UButton
          :label="t('pluto.media.details.copyUrl')"
          icon="lucide:copy"
          color="neutral"
          variant="outline"
          @click="copyUrl"
        />
        <UButton
          :to="href"
          :label="t('pluto.media.details.open')"
          icon="lucide:external-link"
          target="_blank"
          color="neutral"
          variant="ghost"
        />
      </div>

      <USeparator v-if="can('media:delete')" />

      <UModal
        v-if="can('media:delete')"
        v-model:open="confirmOpen"
        :title="t('pluto.media.details.delete')"
        :description="
          t('pluto.media.details.deleteConfirm', { name: media.name })
        "
      >
        <UButton
          :label="t('pluto.media.details.delete')"
          icon="lucide:trash"
          color="error"
          variant="soft"
          class="self-start"
        />

        <template #footer>
          <div class="flex w-full justify-end gap-2">
            <UButton
              :label="t('pluto.common.cancel')"
              color="neutral"
              variant="ghost"
              @click="confirmOpen = false"
            />
            <UButton
              :label="t('pluto.common.delete')"
              :loading="deleting"
              color="error"
              @click="remove"
            />
          </div>
        </template>
      </UModal>
    </div>
  </UTheme>
</template>
