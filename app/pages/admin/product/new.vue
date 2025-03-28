<template>
  <div>
    <div class="flex items-start justify-between gap-x-6">
      <div class="grow bg-transparent">
        <input
          v-model="form.name"
          v-autofocus
          placeholder="Product name"
          type="text"
          class="h-full w-full px-4 py-8 text-4xl font-bold outline-0"
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
        <div class="relative aspect-video rounded-3xl bg-black/10">
          <label for="main-image" class="absolute top-0 left-0 h-full w-full">
            <input
              id="main-image"
              type="file"
              accept="image/*"
              @change="onFileChange"
            />
          </label>

          <img src="" alt="" />
        </div>
      </div>

      <div class="flex flex-col gap-y-6">
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

  useHead({
    title: 'Add new product',
  })

  interface Form {
    name: string
    slug: string
    description: string
    price: number
    productStyles: string[]
    images: FileList | never[] | null
  }

  const form = ref<Form>({
    name: '',
    slug: '',
    description: '',
    price: 0,
    productStyles: [],
    images: [],
  })

  function onFileChange() {}

  function submitForm() {
    type Payload = Omit<
      Database['public']['Tables']['products']['Insert'],
      'id' | 'created_at'
    >

    const payload: Payload = {
      slug: form.value.slug,
      name: form.value.name || 'Untitled',
      description: form.value.description || null,
      price: form.value.price ?? 0,
    }

    $fetch('/api/product/new', {
      method: 'POST',
      body: payload,
    })
  }
</script>
