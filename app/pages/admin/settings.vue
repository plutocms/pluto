<script setup lang="ts">
import { object, string } from 'yup'

type Form = Record<
  Database['public']['Tables']['settings']['Insert']['setting_name'],
  string
>

const toast = useToast()

const has_settings_modified = useState('has_settings_modified', () => {
  return Date.now()
})

const { data } = await useFetch('/api/settings')

const schema = object({
  website_title: string().required().label('Website Title'),
  website_description: string().required().label('Website Description'),
  website_url: string().url().required().label('Website URL'),
})

const form = ref<Form>({
  website_title: data.value?.settings.website_title || '',
  website_description: data.value?.settings.website_description || '',
  website_url: data.value?.settings.website_url || '',
})

const isSubmitting = ref<boolean>(false)

async function submitForm() {
  const payload = form.value

  isSubmitting.value = true

  try {
    await $fetch('/api/settings/update', {
      method: 'POST',
      body: payload,
    })

    toast.add({
      title: 'Settings updated successfully',
      color: 'success',
    })

    has_settings_modified.value = Date.now()
  } catch (error) {
    if (import.meta.dev) {
      console.error('Error updating settings:', error)
    }

    toast.add({
      title: 'Failed to update settings.',
      color: 'error',
    })
  } finally {
    isSubmitting.value = false
  }
}
</script>

<template>
  <AdminView>
    <h1 class="text-4xl font-bold">Settings</h1>

    <UCard>
      <UForm :schema="schema" :state="form" @submit="submitForm">
        <div class="flex flex-col gap-y-6">
          <UFormField label="Website Title" name="website_title">
            <UInput
              v-model="form.website_title"
              placeholder="e.g. My Website"
            />
          </UFormField>

          <UFormField label="Website Description" name="website_description">
            <UInput
              v-model="form.website_description"
              placeholder="e.g. My Website Description"
            />
          </UFormField>

          <UFormField label="Website URL" name="website_url">
            <UInput
              v-model="form.website_url"
              type="url"
              placeholder="e.g. https://example.com"
            />
          </UFormField>

          <div>
            <UButton
              :loading="isSubmitting"
              :disabled="isSubmitting"
              type="submit"
              icon="lucide:save"
            >
              Save
            </UButton>
          </div>
        </div>
      </UForm>
    </UCard>
  </AdminView>
</template>
