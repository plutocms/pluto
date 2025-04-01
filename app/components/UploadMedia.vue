<template>
  <Modal v-model="isMediaModalOpen" prevent-click-outside>
    <ModalHeader @close="closeMediaModal">Insert media</ModalHeader>

    <ModalContent>
      <template #header>
        <UTabs v-model="currentTab" :items="tabs" class="w-full">
          <template #gallery>
            <div class="flex flex-col gap-y-6 pt-6">
              <div class="flex items-center justify-between">
                <div>
                  <span v-if="selectedMedia.length === 0">
                    Showing {{ mediaList?.data.length }} file{{
                      mediaList?.data.length === 1 ? '' : 's'
                    }}
                  </span>

                  <span v-else>
                    {{ selectedMedia.length }} of
                    {{ mediaList?.data.length }} files selected
                  </span>
                </div>

                <div>
                  <UButton
                    icon="lucide:refresh-cw"
                    :loading="mediaStatus === 'pending'"
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
          </template>

          <template #upload>
            <div class="flex gap-x-4">
              <div
                class="group relative aspect-video grow overflow-hidden rounded-3xl bg-black hover:bg-black/20"
              >
                <label
                  v-if="!mediaBlobList || mediaBlobList?.length === 0"
                  for="main-image"
                  class="absolute top-0 left-0 h-full w-full"
                  @click="open()"
                />

                <div
                  v-if="!mediaBlobList || mediaBlobList?.length === 0"
                  class="pointer-events-none absolute top-0 left-0 grid h-full w-full place-items-center"
                >
                  <Icon
                    name="lucide:plus"
                    class="text-5xl opacity-20 transition-opacity group-hover:opacity-100"
                  />
                </div>

                <img
                  v-if="mediaBlobList?.[0]"
                  :src="mediaBlobList[0]"
                  class="h-full w-full object-contain"
                />
              </div>

              <div class="flex w-[300px] shrink-0 flex-col gap-y-4">
                <div>{{ files?.[0]?.name }}</div>

                <div v-if="isUploaded && files?.[0]?.name" class="truncate">
                  <ULink
                    :href="getMediaUrl(kebabCase(files[0].name))"
                    target="_blank"
                  >
                    {{ getMediaUrl(kebabCase(files[0].name)) }}
                  </ULink>
                </div>

                <div class="flex items-center gap-x-2">
                  <UButton
                    v-if="!isUploaded && mediaBlobList?.length > 0"
                    color="error"
                    variant="outline"
                    icon="lucide:x"
                    @click="removeImage"
                  >
                    Cancel
                  </UButton>

                  <UButton
                    v-if="!isUploaded && files"
                    :loading="isUploading"
                    :disabled="isUploaded"
                    icon="lucide:upload"
                    loading-icon="lucide:loader-circle"
                    @click="uploadMedia"
                  >
                    Upload{{ isUploading ? 'ing...' : '' }}
                  </UButton>
                </div>
              </div>
            </div>
          </template>
        </UTabs>
      </template>
    </ModalContent>

    <ModalFooter>
      <div class="flex items-center gap-x-3">
        <UButton variant="ghost" size="xl" icon="lucide:x"> Close </UButton>

        <UButton
          :disabled="isInsertButtonDisabled"
          variant="solid"
          size="xl"
          icon="lucide:check"
          @click="insertMedia"
        >
          Insert
        </UButton>
      </div>
    </ModalFooter>
  </Modal>
</template>

<script setup lang="ts">
  import type { TabsItem } from '@nuxt/ui'
  import { kebabCase } from 'change-case'
  import type { Database } from '~~/types/supabase'

  const isMediaModalOpen = defineModel<boolean>({
    default: false,
  })

  const { getMediaUrl } = useMedia()

  const {
    data: mediaList,
    refresh: refreshMediaList,
    status: mediaStatus,
  } = useFetch('/api/media/list', {
    key: '/api/media/list',
  })

  function closeMediaModal() {
    isMediaModalOpen.value = false
  }

  const currentTab = ref<'0' | '1'>('0')

  watch(currentTab, () => {
    resetAll()
  })

  const tabs = ref<TabsItem[]>([
    {
      label: 'Gallery',
      icon: 'lucide:blocks',
      slot: 'gallery',
    },
    {
      label: 'Upload from your computer',
      icon: 'lucide:upload',
      slot: 'upload',
    },
  ])

  const { files, onChange, open, reset } = useFileDialog({
    accept: 'image/*',
  })

  const mediaBlobList = ref<string[]>([])

  onChange(async () => {
    const file = files.value?.[0]

    if (!file) return

    if (!mediaBlobList.value) {
      mediaBlobList.value = []
    }

    const blob = useObjectURL(file).blob.value

    if (!blob) return

    mediaBlobList.value?.push(blob)
  })

  const isUploaded = ref<boolean>(false)
  const isUploading = ref<boolean>(false)

  async function uploadMedia() {
    let response
    const file = files.value?.[0]

    const formData = new FormData()

    if (!file) return

    formData.append('media_file', file)
    formData.append('name', file.name)
    formData.append('alt', form.value.alt)

    try {
      isUploading.value = true

      response = await $fetch('/api/media/new', {
        method: 'POST',
        body: formData,
      })

      if (response) {
        isUploaded.value = true
      }
    } catch (error) {
      console.error(error)
    } finally {
      isUploading.value = false
    }
  }

  function removeImage() {
    mediaBlobList.value = []

    reset()
  }

  const selectedMedia = ref<number[]>([])

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

  const transformedSelectedMedia = computed<EmitValue[]>(() => {
    const value = selectedMedia.value
      ?.map(item => {
        if (!mediaList.value) return undefined

        return mediaList.value.data.find(dataItem => item === dataItem.id)
      })
      .filter((item): item is EmitValue => item !== undefined)

    return value
  })

  type EmitValue = Database['public']['Tables']['media']['Row']

  const emit = defineEmits<{
    insert: [value: EmitValue[]]
  }>()

  function insertMedia() {
    if (!transformedSelectedMedia.value) return

    emit('insert', transformedSelectedMedia.value)

    resetAll()
  }

  function resetAll() {
    reset()

    selectedMedia.value = []
  }

  const isInsertButtonDisabled = computed(
    () =>
      (currentTab.value === '0' && selectedMedia.value.length === 0) ||
      (currentTab.value === '1' && isUploaded.value === false)
  )
</script>
