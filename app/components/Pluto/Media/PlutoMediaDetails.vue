<script setup lang="ts">
// The details of one file, in the aside of the Media page: the file (an image,
// or the viewer of its kind, for example the 3D viewer), its facts, the name
// and the alt text, copy the URL or Markdown, download, make a preview, delete.
import type { PlutoMedia } from '../../../../shared/types/media'

const props = defineProps<{ media: PlutoMedia }>()

const emit = defineEmits<{
  updated: [media: PlutoMedia]
  deleted: [id: string]
}>()

const { t, tx, d, locale } = usePlutoI18n()
const errorText = usePlutoErrorText()
const { can } = usePlutoPermissions()
const toast = useToast()
const library = usePlutoMedia()

const name = ref(props.media.name)
const alt = ref(props.media.alt)
watch(
  () => props.media,
  (media) => {
    name.value = media.name
    alt.value = media.alt
  }
)

const image = computed(() => isMediaImage(props.media))
const kind = computed(() => library.kinds.kindOf(props.media.mimeType))
const href = computed(() =>
  import.meta.client
    ? new URL(props.media.url, window.location.origin).href
    : props.media.url
)
const canManage = computed(() => can('media:manage'))

const facts = computed(() =>
  [
    {
      label: t('pluto.media.details.type'),
      value: kind.value
        ? `${tx(kind.value.label)} · ${props.media.mimeType}`
        : props.media.mimeType,
    },
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

const changed = computed(
  () =>
    name.value.trim() !== props.media.name ||
    (image.value && alt.value !== props.media.alt)
)

const saving = ref(false)
async function save() {
  saving.value = true
  try {
    const record = await library.update(props.media.id, {
      name: name.value.trim() || props.media.name,
      ...(image.value ? { alt: alt.value } : {}),
    })
    emit('updated', record)
    toast.add({
      title: t('pluto.media.details.saved'),
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
async function copyText(text: string) {
  await copy(text)
  toast.add({
    title: t('pluto.media.details.copied'),
    color: 'success',
    icon: 'lucide:copy',
  })
}

const copyItems = computed(() => [
  [
    {
      label: t('pluto.media.details.copyUrl'),
      icon: 'lucide:link',
      onSelect: () => copyText(href.value),
    },
    ...(image.value
      ? [
          {
            label: t('pluto.media.details.copyMarkdown'),
            icon: 'lucide:file-code',
            onSelect: () =>
              copyText(`![${props.media.alt}](${props.media.url})`),
          },
        ]
      : []),
    {
      label: t('pluto.media.details.copyId'),
      icon: 'lucide:hash',
      onSelect: () => copyText(props.media.id),
    },
  ],
])

const previewing = ref(false)
async function makePreview() {
  previewing.value = true
  try {
    const record = await library.createPreview(props.media)
    if (!record) {
      throw new Error(t('pluto.media.details.previewFailed'))
    }
    emit('updated', record)
    toast.add({
      title: t('pluto.media.details.previewMade'),
      color: 'success',
      icon: 'lucide:image',
    })
  } catch (error) {
    toast.add({
      title: t('pluto.media.details.previewFailed'),
      description: errorText(error),
      color: 'error',
    })
  } finally {
    previewing.value = false
  }
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
  <div class="flex flex-col gap-5">
    <!-- The file: the image, the viewer of its kind, its preview, or an icon. -->
    <div
      class="bg-elevated ring-default relative flex aspect-square items-center justify-center overflow-hidden rounded-lg ring"
    >
      <img
        v-if="image"
        :src="media.url"
        :alt="media.alt"
        class="size-full object-contain"
      />
      <component :is="kind.viewer" v-else-if="kind?.viewer" :media="media" />
      <img
        v-else-if="media.preview"
        :src="media.preview.url"
        alt=""
        class="size-full object-contain"
      />
      <UIcon
        v-else
        :name="kind?.icon ?? 'lucide:file'"
        class="text-muted size-12"
      />
    </div>

    <div class="flex flex-wrap gap-2">
      <UDropdownMenu :items="copyItems">
        <UButton
          :label="t('pluto.media.details.copy')"
          icon="lucide:copy"
          trailing-icon="lucide:chevron-down"
          color="neutral"
          variant="outline"
        />
      </UDropdownMenu>
      <UButton
        :to="href"
        :label="t('pluto.media.details.open')"
        icon="lucide:external-link"
        target="_blank"
        color="neutral"
        variant="ghost"
      />
      <UButton
        :href="href"
        :download="media.name"
        :label="t('pluto.media.details.download')"
        icon="lucide:download"
        color="neutral"
        variant="ghost"
      />
    </div>

    <dl class="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-sm">
      <template v-for="fact in facts" :key="fact.label">
        <dt class="text-muted">{{ fact.label }}</dt>
        <dd class="min-w-0 break-all">{{ fact.value }}</dd>
      </template>
    </dl>

    <UFormField :label="t('pluto.media.details.name')">
      <UInput
        v-model="name"
        :disabled="!canManage"
        :maxlength="200"
        class="w-full"
      />
    </UFormField>

    <UFormField
      v-if="image"
      :label="t('pluto.media.details.alt')"
      :description="t('pluto.media.details.altHint')"
    >
      <UTextarea
        v-model="alt"
        :disabled="!canManage"
        :rows="2"
        :maxlength="500"
        class="w-full"
        autoresize
      />
    </UFormField>

    <UButton
      v-if="canManage"
      :label="t('pluto.common.save')"
      :loading="saving"
      :disabled="!changed"
      class="self-start"
      @click="save"
    />

    <!-- A kind that can make a preview (a 3D model): make it for a file that has none, or again. -->
    <div
      v-if="kind?.createPreview && canManage"
      class="bg-elevated/60 ring-default flex items-center gap-3 rounded-lg p-3 ring"
    >
      <img
        v-if="media.preview"
        :src="media.preview.url"
        alt=""
        class="size-14 shrink-0 rounded-md object-cover"
      />
      <div class="min-w-0 flex-1 text-sm">
        <p class="font-medium">{{ t('pluto.media.details.preview') }}</p>
        <p class="text-muted text-xs">
          {{
            media.preview
              ? t('pluto.media.details.previewHint')
              : t('pluto.media.details.noPreview')
          }}
        </p>
      </div>
      <UButton
        :label="
          media.preview
            ? t('pluto.media.details.remakePreview')
            : t('pluto.media.details.makePreview')
        "
        :loading="previewing"
        color="neutral"
        variant="outline"
        size="sm"
        @click="makePreview"
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
</template>
