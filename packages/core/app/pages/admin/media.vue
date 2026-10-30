<script setup lang="ts">
// The media library of the app, for every backend. A click on a file opens
// its details in the aside. See the media skill.
import type { PlutoMedia } from '../../../shared/types/media'
import type PlutoMediaLibrary from '../../components/Pluto/Media/PlutoMediaLibrary.vue'

const { t } = usePlutoI18n()
const { can } = usePlutoPermissions()
const media = usePlutoMedia()
const toast = useToast()
const errorText = usePlutoErrorText()

useHead({ title: () => t('pluto.pages.media') })

if (!media.enabled) {
  throw createError({
    statusCode: 404,
    statusMessage: 'No media storage is set up.',
    fatal: true,
  })
}

const library =
  useTemplateRef<InstanceType<typeof PlutoMediaLibrary>>('library')
const active = ref<PlutoMedia | null>(null)
const asideOpen = computed({
  get: () => active.value !== null,
  set: (open: boolean) => {
    if (!open) {
      active.value = null
    }
  },
})

function onUpdated(record: PlutoMedia) {
  active.value = record
  library.value?.replace(record)
}

function onBulkDeleted(ids: string[]) {
  if (active.value && ids.includes(active.value.id)) {
    active.value = null
  }
}

function onDeleted(id: string) {
  active.value = null
  library.value?.drop(id)
}

const filling = ref(false)
async function fillSizes() {
  filling.value = true
  try {
    const result = await media.fillSizes()
    toast.add({
      title: t('pluto.media.sizesDone', result),
      color: result.failed ? 'warning' : 'success',
    })
    library.value?.reload()
  } catch (error) {
    toast.add({
      title: t('pluto.media.errors.saveFailed'),
      description: errorText(error),
      color: 'error',
    })
  } finally {
    filling.value = false
  }
}
</script>

<template>
  <PlutoViewAdminPanel v-model:aside-open="asideOpen">
    <template #toolbar>
      <PlutoViewToolbar :title="t('pluto.pages.media')" icon="lucide:images">
        <template #right>
          <UButton
            v-if="can('media:manage')"
            :label="t('pluto.media.fillSizes')"
            :loading="filling"
            icon="lucide:ruler"
            color="neutral"
            variant="ghost"
            @click="fillSizes"
          />
        </template>
      </PlutoViewToolbar>
    </template>

    <div class="py-6">
      <PlutoMediaLibrary
        ref="library"
        v-model:active="active"
        mode="manage"
        @deleted="onBulkDeleted"
      />
    </div>

    <template #aside>
      <PlutoViewAside
        v-model:open="asideOpen"
        :title="t('pluto.media.details.title')"
      >
        <PlutoMediaDetails
          v-if="active"
          :media="active"
          @updated="onUpdated"
          @deleted="onDeleted"
        />
      </PlutoViewAside>
    </template>
  </PlutoViewAdminPanel>
</template>
