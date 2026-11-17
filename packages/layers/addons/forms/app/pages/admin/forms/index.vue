<script setup lang="ts">
interface FormEntry {
  handle: string
  title: string
  source: 'content' | 'code'
}

const { t } = usePlutoI18n()
const { can } = usePlutoPermissions()

useHead({
  title: () => t('forms.admin.title'),
})

const { data, status } = useFetch<{ forms: FormEntry[] }>('/api/_pluto/forms', {
  key: 'pluto-forms-list',
  server: false,
  lazy: true,
})

const forms = computed(() => data.value?.forms ?? [])
</script>

<template>
  <PlutoViewAdminPanel>
    <template #toolbar>
      <PlutoViewToolbar
        :title="t('forms.admin.title')"
        icon="i-lucide-inbox"
      />
    </template>

    <div class="flex flex-col gap-y-4 py-6">
      <p class="text-muted text-sm">
        {{ t('forms.admin.intro') }}
      </p>

      <UAlert
        v-if="!can('forms:read_submissions')"
        :title="t('forms.admin.noAccess')"
        color="warning"
        variant="subtle"
        icon="i-lucide-lock"
      />

      <template v-else>
        <p v-if="status === 'pending'" class="text-muted text-sm">
          {{ t('forms.admin.loading') }}
        </p>

        <UAlert
          v-else-if="forms.length === 0"
          :title="t('forms.admin.empty')"
          :description="t('forms.admin.emptyHint')"
          color="neutral"
          variant="subtle"
          icon="i-lucide-text-cursor-input"
        />

        <ul v-else class="divide-default border-default divide-y rounded-md border">
          <li v-for="form in forms" :key="form.handle">
            <NuxtLink
              :to="`/admin/forms/${form.handle}`"
              class="hover:bg-elevated flex items-center justify-between gap-x-4 px-4 py-3"
            >
              <span class="flex flex-col">
                <span class="font-medium">{{ form.title }}</span>

                <span class="text-muted text-xs">{{ form.handle }}</span>
              </span>

              <span class="flex items-center gap-x-3">
                <UBadge
                  v-if="form.source === 'code'"
                  :label="t('forms.admin.inCode')"
                  color="neutral"
                  variant="subtle"
                />

                <UIcon name="i-lucide-chevron-right" class="text-muted" />
              </span>
            </NuxtLink>
          </li>
        </ul>
      </template>
    </div>
  </PlutoViewAdminPanel>
</template>
