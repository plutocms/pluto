<script setup lang="ts">
useHead({
  title: 'Media',
})

const { getMediaUrl } = useMedia()

const selectedMedia = ref<number[]>([])

const {
  data: mediaList,
  refresh: refreshMediaList,
  status: mediaStatus,
} = useFetch('/api/media/list', {
  key: '/api/media/list',
})

function isSelected(id: number) {
  return selectedMedia.value.includes(id)
}

function selectMedia(id: number) {
  if (selectedMedia.value.includes(id)) {
    const index = selectedMedia.value.indexOf(id)

    selectedMedia.value.splice(index, 1)

    return
  }

  selectedMedia.value.push(id)
}
</script>

<template>
  <main>
    <AdminView>
      <div class="flex flex-col gap-y-4">
        <h1 class="text-4xl font-bold">Media</h1>

        <div class="flex items-end justify-between">
          <div>
            <span v-if="selectedMedia.length === 0">
              Showing {{ mediaList?.data.length }} file{{
                mediaList?.data.length === 1 ? '' : 's'
              }}
            </span>

            <span v-else>
              {{ selectedMedia.length }} of {{ mediaList?.data.length }} files
              selected
            </span>
          </div>

          <div>
            <UButton
              :loading="mediaStatus === 'pending'"
              icon="lucide:refresh-cw"
              @click="refreshMediaList()"
            >
              Refresh
            </UButton>
          </div>
        </div>

        <div class="grid grid-cols-5 gap-3">
          <div
            v-for="file in mediaList?.data"
            :key="file.id"
            class="group/image-select relative aspect-square overflow-hidden rounded-2xl bg-black select-none hover:ring-1 has-[[aria-checked='true']]:ring-2 has-[[aria-checked='true']]:ring-green-400"
          >
            <label
              class="absolute top-0 left-0 grid h-full w-full items-start justify-end"
            >
              <div class="rounded-bl-2xl bg-black/80 p-2">
                <UCheckbox
                  :model-value="isSelected(file.id)"
                  @change="selectMedia(file.id)"
                />
              </div>
            </label>

            <img
              v-if="file.name"
              :src="getMediaUrl(file.name)"
              :alt="file.alt || file.name"
              class="h-full w-full object-contain"
            />
          </div>
        </div>
      </div>
    </AdminView>
  </main>
</template>
