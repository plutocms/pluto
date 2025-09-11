<script lang="ts">
import { useChangeCase } from '@vueuse/integrations/useChangeCase'

type Product = Database['public']['Tables']['products']['Row']
type Media = Database['public']['Tables']['media']['Row'] & {
  is_saved?: boolean
}

export interface Form extends Omit<Product, 'id' | 'created_at'> {
  media: Media[]
  product_style: string
}
</script>

<script setup lang="ts">
const props = defineProps<{
  productId?: number
}>()

const route = useRoute('admin-product-edit-id')

useHead({
  title: route.params.id ? 'Edit product' : 'Add new product',
})

const { getMediaUrl } = useMedia()

const productSlug = useChangeCase('', 'kebabCase')

const currentSelectedImage = ref<number>(0)
const lastImageIndex = computed<number>(() => form.value.media?.length - 1)
const isEditing = computed<boolean>(() => route.path.includes('edit'))
const removedMediaIds = ref<number[]>([])

const { data: categories, refresh: refreshCategories } =
  await useFetch('/api/category/list')

const productStyles = computed(() => {
  if (!categories.value?.data) {
    return
  }

  const transformedData = categories.value.data.map((item) => {
    return item.label
  })

  return transformedData
})

const form = defineModel<Form>({
  default: {
    name: '',
    slug: '',
    description: '',
    price: 0,
    product_style: '',
    media: [],
    is_custom: false,
    stock_quantity: null,
    availability: 'preorder',
  },
})

const availabilityOptions = computed(() => {
  return [
    {
      label: 'In Stock',
      value: 'in_stock',
      disabled: form.value.is_custom,
    },
    {
      label: 'Preorder',
      value: 'preorder',
    },
  ]
})

watch(
  () => form.value.name,
  (value) => {
    if (form.value.slug !== route.params.id) {
      productSlug.value = slugify(value) ?? ''

      form.value.slug = slugify(productSlug.value)
    }
  }
)

watch(
  () => form.value.slug,
  (value) => {
    productSlug.value = slugify(value) ?? ''

    form.value.slug = slugify(productSlug.value)
  }
)

const isSubmitting = ref<boolean>(false)

async function submitForm() {
  type Payload = Omit<
    Database['public']['Tables']['products']['Insert'],
    'created_at'
  > & { media: Media[] }

  const payload: Payload & { removedMediaIds?: number[] } = {
    id: props.productId ?? undefined,
    slug: form.value?.slug ?? '',
    name: form.value?.name || 'Untitled',
    description: form.value?.description || null,
    price: form.value?.price ?? 0,
    media: form.value?.media?.map(({ is_saved, ...rest }) => rest),
    product_style: form.value?.product_style,
    is_custom: form.value?.is_custom ?? false,
    stock_quantity: form.value?.stock_quantity,
    availability: form.value?.availability,
    removedMediaIds: isEditing.value ? removedMediaIds.value : undefined,
  }

  try {
    isSubmitting.value = true

    if (!isEditing.value) {
      const { data } = await $fetch('/api/product/new', {
        method: 'POST',
        body: payload,
      })

      navigateTo(`/admin/product/edit/${data.id}`)

      return
    }

    await $fetch(`/api/product/edit/${payload.id}`, {
      method: 'POST',
      body: payload,
    })

    removedMediaIds.value = []
  } catch (error) {
    console.error('An error occurred')
  } finally {
    isSubmitting.value = false

    // set all media is_saved to true
    form.value.media.forEach((media) => {
      media.is_saved = true
    })
  }
}

const isMediaModalOpen = ref<boolean>(false)

function openMediaModal() {
  isMediaModalOpen.value = true
}

function closeMediaModal() {
  isMediaModalOpen.value = false
}

function is3d(item: Media | Media[] | null) {
  if (Array.isArray(item)) {
    return item.some((i) => i.name?.endsWith('.glb'))
  }

  return item?.name?.endsWith('.glb')
}

function removeMedia(index: number) {
  const removed = form.value.media[index]
  if (removed && removed.id) {
    removedMediaIds.value.push(removed.id)
  }
  form.value.media.splice(index, 1)

  if (currentSelectedImage.value === index) {
    currentSelectedImage.value = 0
  } else if (currentSelectedImage.value > index) {
    currentSelectedImage.value -= 1
  }
}

function handleInsertMedia(event: Media | Media[] | null) {
  // Remove previous .glb media before inserting new one
  form.value.media = form.value.media.filter((m) => !m.name?.endsWith('.glb'))

  if (Array.isArray(event)) {
    if (form.value.media?.length > 0) {
      form.value.media.push(...event)
    } else {
      form.value.media = event
    }
  } else {
    if (event) {
      form.value.media.push(event)
    }
  }

  currentSelectedImage.value = lastImageIndex.value

  closeMediaModal()
}

const isCategorySelectOpen = ref<boolean>(false)
const isCategorySelectLoading = ref<boolean>(false)

function onCategorySelectOpen(event: boolean) {
  if (event === true) {
    refreshCategories()
  }
}

async function createCategory(item: string) {
  type Category = Database['public']['Tables']['categories']['Row']

  const payload: Omit<Category, 'id' | 'description'> = {
    label: item,
    slug: slugify(item),
  }

  isCategorySelectLoading.value = true

  await $fetch('/api/category/new', {
    method: 'POST',
    body: payload,
  })
    .then(async () => {
      await refreshCategories()

      form.value.product_style = item

      isCategorySelectOpen.value = false
    })
    .catch((error) => {
      console.error(error.message)
    })
    .finally(() => {
      isCategorySelectLoading.value = false
    })
}

watch(
  () => form.value.is_custom,
  (value) => {
    if (value) {
      form.value.availability = 'preorder'

      form.value.stock_quantity = null

      return
    }

    form.value.stock_quantity = 0
  }
)
</script>

<template>
  <div>
    <UploadMedia
      v-model="isMediaModalOpen"
      :product-id="props.productId"
      @insert="handleInsertMedia"
    />

    <div class="flex items-start justify-between gap-x-6">
      <div class="self-center pt-6 pl-6">
        <UButton
          as="NuxtLink"
          to="/admin/products"
          variant="subtle"
          color="neutral"
          class="h-10 w-10 shrink-0 rounded-full text-2xl"
          title="Back to Products list"
          icon="lucide:arrow-left"
          square
        />
      </div>

      <div class="grow bg-transparent">
        <input
          v-model="form.name"
          v-autofocus
          placeholder="Add title"
          type="text"
          class="light:text-zinc-600 h-full w-full px-4 pt-8 text-4xl font-bold outline-0 dark:text-white"
        />
      </div>

      <div class="pt-4 pr-4">
        <div class="flex gap-x-2">
          <UButton
            :icon="isEditing ? 'lucide:save' : 'lucide:check'"
            :loading="isSubmitting"
            :disabled="form.name === ''"
            type="button"
            size="xl"
            @click="submitForm"
          >
            {{ isEditing ? 'Save' : 'Publish' }}
          </UButton>

          <UButton
            v-if="isEditing"
            :to="`/product/${props.productId}-${form.slug}`"
            icon="lucide:eye"
            variant="link"
            as="NuxtLink"
            target="_blank"
          >
            Preview
          </UButton>
        </div>
      </div>
    </div>

    <div class="flex gap-x-6 px-4 py-8">
      <div class="grow">
        <div class="flex h-[500px] gap-x-1">
          <ScrollArea class="w-20 rounded-2xl">
            <div
              class="box-content flex w-full flex-col gap-y-3 pt-1 pr-4 pl-1"
            >
              <template v-if="form.media && form.media?.length > 0">
                <div
                  v-for="(image, index) in form.media"
                  :key="index"
                  :class="[
                    currentSelectedImage === index && 'ring-2 ring-green-400',
                    !image.is_saved && 'opacity-50',
                    is3d(image) ? 'hidden' : '',
                  ]"
                  :title="!image.is_saved ? 'Unsaved' : ''"
                  class="h-14 w-14 overflow-hidden rounded-2xl bg-black/10 hover:bg-black/20"
                  @click="currentSelectedImage = index"
                >
                  <img
                    v-if="image.name"
                    :src="getMediaUrl(image.name)"
                    class="h-full w-full object-cover"
                  />
                </div>
              </template>

              <div
                class="dark:bg-admin-content light:bg-white sticky -bottom-0.5 mb-8 -ml-0.5 w-full py-2 pl-0.5"
              >
                <div class="flex flex-col gap-y-3">
                  <div
                    v-if="form.media && form.media.find((m) => is3d(m))"
                    class="grid h-14 w-14 place-items-center overflow-hidden rounded-2xl bg-black/90 hover:bg-black/100"
                    @click="openMediaModal"
                  >
                    <Icon name="lucide:rotate-3d" class="text-2xl" />
                  </div>

                  <div
                    class="grid h-14 w-14 place-items-center overflow-hidden rounded-2xl bg-black/90 hover:bg-black/100"
                    @click="openMediaModal"
                  >
                    <Icon name="lucide:plus" class="text-2xl" />
                  </div>
                </div>
              </div>
            </div>
          </ScrollArea>

          <div class="aspect-square w-[600px]">
            <div
              :class="[
                form.media?.length > 0
                  ? 'bg-black'
                  : 'bg-black/10 hover:bg-black/20',
              ]"
              class="group relative h-full overflow-hidden rounded-3xl"
            >
              <label
                v-if="!form.media || form.media?.length === 0"
                for="main-image"
                class="absolute top-0 left-0 h-full w-full"
                @click="openMediaModal"
              />

              <div class="absolute right-0 bottom-0 p-3">
                <UButton
                  v-if="form.media && form.media.length > 0"
                  variant="soft"
                  color="error"
                  title="Remove media"
                  square
                  @click="removeMedia(currentSelectedImage)"
                >
                  <Icon name="lucide:trash" class="text-2xl" />
                </UButton>
              </div>

              <div
                v-if="!form.media || form.media?.length === 0"
                class="pointer-events-none absolute top-0 left-0 grid h-full w-full place-items-center"
              >
                <Icon
                  name="lucide:plus"
                  class="text-5xl opacity-20 transition-opacity group-hover:opacity-100"
                />
              </div>

              <img
                v-if="!!form.media?.[currentSelectedImage]?.name"
                :src="getMediaUrl(form.media[currentSelectedImage]!.name!)"
                class="h-full w-full object-contain"
              />
            </div>
          </div>
        </div>
      </div>

      <div class="w-[300px] shrink-0">
        <div class="flex flex-col gap-y-6">
          <UFormField label="Description">
            <UTextarea
              v-model="form.description"
              placeholder="Description"
              class="w-full"
            />
          </UFormField>

          <UFormField
            :help="`/product/${props.productId}-${form.slug}`"
            label="Slug"
          >
            <UInput v-model="form.slug" placeholder="slug" class="w-full" />
          </UFormField>

          <UFormField label="Price">
            <UInputNumber
              v-model.number="form.price"
              :format-options="{
                style: 'currency',
                currency: 'BRL',
                currencyDisplay: 'symbol',
                currencySign: 'accounting',
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              }"
              class="w-full"
            />
          </UFormField>

          <UFormField label="Is custom">
            <USwitch v-model="form.is_custom" />
          </UFormField>

          <UFormField label="Availability">
            <USelect
              v-model="form.availability"
              :items="availabilityOptions"
              value="preorder"
              class="w-full"
            />
          </UFormField>

          <UFormField
            v-if="form.availability === 'in_stock'"
            label="Stock Quantity"
          >
            <UInputNumber v-model="form.stock_quantity" class="w-full" />
          </UFormField>

          <UFormField label="Style">
            <UInputMenu
              v-model="form.product_style"
              v-model:open="isCategorySelectOpen"
              :items="productStyles"
              :loading="isCategorySelectLoading"
              loading-icon="line-md:loading-loop"
              class="w-full"
              placeholder="e.g: Chibi"
              create-item
              @create="createCategory"
              @update:open="onCategorySelectOpen"
            />
          </UFormField>
        </div>
      </div>
    </div>
  </div>
</template>
