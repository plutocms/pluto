<template>
  <div>
    <UploadMedia v-model="isMediaModalOpen" />

    <div class="flex items-start justify-between gap-x-6">
      <div class="grow bg-transparent">
        <input
          v-model="form.name"
          v-autofocus
          placeholder="Product name"
          type="text"
          class="h-full w-full px-4 pt-8 text-4xl font-bold outline-0"
        />
      </div>

      <div class="pt-4 pr-4">
        <UButton
          type="button"
          icon="lucide:check"
          size="xl"
          @click="submitForm"
        >
          Publish
        </UButton>
      </div>
    </div>

    <div class="flex gap-x-6 px-4 py-8">
      <div class="grow">
        <div class="flex gap-x-4">
          <div class="flex flex-col gap-y-3">
            <template v-if="form.images && form.images?.length > 0">
              <div
                v-for="(image, index) in form.images"
                :key="index"
                :class="[
                  'h-14 w-14 shrink-0 overflow-hidden rounded-2xl bg-black/10 hover:bg-black/20',
                  currentSelectedImage === index && 'ring-2 ring-green-400',
                ]"
                @click="currentSelectedImage = index"
              >
                <img :src="image" class="h-full w-full object-cover" />
              </div>
            </template>

            <div
              class="sticky bottom-0 grid h-14 w-14 shrink-0 place-items-center overflow-hidden rounded-2xl bg-black/10 hover:bg-black/20"
              @click="openMediaModal"
            >
              <Icon name="lucide:plus" class="text-2xl" />
            </div>
          </div>

          <div class="grow">
            <div
              class="group relative aspect-video overflow-hidden rounded-3xl bg-black/10 hover:bg-black/20"
            >
              <label
                v-if="!form.images || form.images?.length === 0"
                for="main-image"
                class="absolute top-0 left-0 h-full w-full"
                @click="openMediaModal"
              />

              <div
                v-if="!form.images || form.images?.length === 0"
                class="pointer-events-none absolute top-0 left-0 grid h-full w-full place-items-center"
              >
                <Icon
                  name="lucide:plus"
                  class="text-5xl opacity-20 transition-opacity group-hover:opacity-100"
                />
              </div>

              <img
                v-if="form.images?.[currentSelectedImage]"
                :src="form.images[currentSelectedImage]"
                class="h-full w-full object-cover"
              />
            </div>
          </div>
        </div>
      </div>

      <div class="flex w-[300px] shrink-0 flex-col gap-y-6">
        <div>
          <UFormField label="Description">
            <UTextarea
              v-model="form.description"
              placeholder="Description"
              class="w-full"
            />
          </UFormField>
        </div>

        <div>
          <UFormField label="Slug" :help="`/product/${form.slug}`">
            <UInput v-model="form.slug" placeholder="slug" class="w-full" />
          </UFormField>
        </div>

        <div>
          <UFormField label="Price">
            <UInputNumber
              v-model="form.price"
              :format-options="{
                style: 'currency',
                currency: 'USD',
                currencyDisplay: 'symbol',
                currencySign: 'accounting',
              }"
            />
          </UFormField>
        </div>
      </div>
    </div>

    <pre>{{ form }}</pre>
  </div>
</template>

<script setup lang="ts">
  import type { Database } from '~~/types/supabase'
  import { useChangeCase } from '@vueuse/integrations/useChangeCase'

  useHead({
    title: 'Add new product',
  })

  interface Form {
    name: string
    slug: string
    description: string
    price: number
    productStyles: string[]
    images: string[] | null
  }

  const productSlug = useChangeCase('', 'kebabCase')

  const currentSelectedImage = ref<number>(0)

  const form = reactive<Form>({
    name: '',
    slug: '',
    description: '',
    price: 0,
    productStyles: [],
    images: null,
  })

  watch(
    () => form.name,
    value => {
      productSlug.value = value

      form.slug = productSlug.value
    }
  )

  function submitForm() {
    type Payload = Omit<
      Database['public']['Tables']['products']['Insert'],
      'id' | 'created_at'
    >

    const payload: Payload = {
      slug: form.slug,
      name: form.name || 'Untitled',
      description: form.description || null,
      price: form.price ?? 0,
    }

    $fetch('/api/product/new', {
      method: 'POST',
      body: payload,
    })
  }

  const isMediaModalOpen = ref<boolean>(false)

  function openMediaModal() {
    isMediaModalOpen.value = true
  }
</script>
