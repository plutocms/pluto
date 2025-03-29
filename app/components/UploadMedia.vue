<template>
  <Modal v-model="isMediaModalOpen" prevent-click-outside>
    <ModalHeader @close="closeMediaModal">Title</ModalHeader>

    <ModalContent>
      <template #header>
        <UTabs :items="tabs" class="w-full">
          <template #gallery>
            <div class="grid grid-cols-5 gap-2">
              <div
                v-for="i in 25"
                :key="i"
                class="aspect-square rounded-2xl bg-black/20"
              />
            </div>
          </template>

          <template #upload>
            <div
              class="group relative aspect-video overflow-hidden rounded-3xl bg-black/10 hover:bg-black/20"
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
                class="h-full w-full object-cover"
              />
            </div>
          </template>
        </UTabs>
      </template>
    </ModalContent>

    <ModalFooter>
      <div class="flex items-center gap-x-3">
        <UButton variant="ghost" size="xl" icon="lucide:x"> Close </UButton>

        <UButton variant="solid" size="xl" icon="lucide:check">
          Insert
        </UButton>
      </div>
    </ModalFooter>
  </Modal>
</template>

<script setup lang="ts">
  import type { TabsItem } from '@nuxt/ui'

  const isMediaModalOpen = defineModel<boolean>({
    default: false,
  })

  function closeMediaModal() {
    isMediaModalOpen.value = false
  }

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

  const { files, onChange, open } = useFileDialog({
    accept: 'image/*',
  })

  const mediaBlobList = ref<string[]>([])

  onChange(() => {
    const file = files.value?.[0]
    const formData = new FormData()

    if (!file) return

    formData.append('media_file', file)

    if (!mediaBlobList.value) {
      mediaBlobList.value = []
    }

    const blob = useObjectURL(file).blob.value

    if (!blob) return

    mediaBlobList.value?.push(blob)

    $fetch('/api/media/new', {
      method: 'POST',
    })
  })
</script>
