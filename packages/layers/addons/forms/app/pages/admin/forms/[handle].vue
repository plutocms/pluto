<script setup lang="ts">
import type {
  PlutoFormSubmission,
  PlutoFormSubmissionPage,
  PlutoPublicForm,
} from '../../../../shared/types/forms'

const PAGE_SIZE = 20

const route = useRoute()
const handle = route.params.handle as string

const { t, d } = usePlutoI18n()
const { can } = usePlutoPermissions()
const toast = useToast()
const errorText = usePlutoErrorText()

useHead({
  title: () => t('forms.admin.title'),
})

const page = ref(1)
const active = ref<PlutoFormSubmission | null>(null)
const confirming = ref(false)
const deleting = ref(false)

const { data: form } = useFetch<PlutoPublicForm>(
  `/api/pluto/v1/forms/${handle}`,
  {
    key: `pluto-forms-fields:${handle}`,
    server: false,
    lazy: true,
  }
)

const {
  data: list,
  status,
  error,
  refresh,
} = useFetch<PlutoFormSubmissionPage>(
  `/api/_pluto/forms/${handle}/submissions`,
  {
    key: `pluto-forms-submissions:${handle}`,
    server: false,
    lazy: true,
    query: computed(() => ({
      limit: PAGE_SIZE,
      offset: (page.value - 1) * PAGE_SIZE,
    })),
  }
)

const fields = computed(() =>
  (form.value?.fields ?? []).filter((field) => field.type !== 'hidden')
)

const columns = computed(() => fields.value.slice(0, 3))

const rows = computed(() => list.value?.data ?? [])

const total = computed(() => list.value?.total ?? 0)

const noStore = computed(
  () => (error.value as { statusCode?: number } | null)?.statusCode === 503
)

const open = computed({
  get: () => active.value !== null,
  set: (value: boolean) => {
    if (!value) {
      active.value = null
      confirming.value = false
    }
  },
})

function show(value: unknown): string {
  if (typeof value === 'boolean') {
    return value ? t('forms.admin.yes') : t('forms.admin.no')
  }
  return typeof value === 'string' || typeof value === 'number'
    ? String(value)
    : ''
}

function when(value: string): string {
  return d(value, { dateStyle: 'medium', timeStyle: 'short' })
}

async function remove() {
  if (!active.value) {
    return
  }
  deleting.value = true
  try {
    await $fetch(`/api/_pluto/forms/${handle}/submissions/${active.value.id}`, {
      method: 'DELETE',
    })
    active.value = null
    confirming.value = false
    await refresh()
  } catch (failure) {
    toast.add({
      title: t('forms.admin.deleteFailed'),
      description: errorText(failure),
      color: 'error',
    })
  } finally {
    deleting.value = false
  }
}
</script>

<template>
  <PlutoViewAdminPanel>
    <template #toolbar>
      <PlutoViewToolbar
        :title="form?.title ?? handle"
        icon="i-lucide-inbox"
      >
        <template #right>
          <UButton
            v-if="can('forms:read_submissions')"
            :to="`/api/_pluto/forms/${handle}/export`"
            :label="t('forms.admin.export')"
            icon="i-lucide-download"
            color="neutral"
            variant="ghost"
            external
          />
        </template>
      </PlutoViewToolbar>
    </template>

    <div class="flex flex-col gap-y-4 py-6">
      <UButton
        :label="t('forms.admin.back')"
        to="/admin/forms"
        icon="i-lucide-arrow-left"
        color="neutral"
        variant="link"
        class="self-start px-0"
      />

      <UAlert
        v-if="!can('forms:read_submissions')"
        :title="t('forms.admin.noAccess')"
        color="warning"
        variant="subtle"
        icon="i-lucide-lock"
      />

      <UAlert
        v-else-if="noStore"
        :title="t('forms.admin.noStore')"
        :description="t('forms.admin.noStoreHint')"
        color="warning"
        variant="subtle"
        icon="i-lucide-database-zap"
      >
        <template #actions>
          <UButton
            :label="t('forms.admin.openSetup')"
            to="/admin/settings/forms"
            color="neutral"
            variant="outline"
          />
        </template>
      </UAlert>

      <p v-else-if="status === 'pending' && !list" class="text-muted text-sm">
        {{ t('forms.admin.loading') }}
      </p>

      <UAlert
        v-else-if="rows.length === 0"
        :title="t('forms.admin.noSubmissions')"
        color="neutral"
        variant="subtle"
        icon="i-lucide-inbox"
      />

      <template v-else>
        <div class="border-default overflow-x-auto rounded-md border">
          <table class="w-full text-left text-sm">
            <thead class="bg-elevated text-muted">
              <tr>
                <th scope="col" class="px-4 py-2 font-medium">
                  {{ t('forms.admin.date') }}
                </th>

                <th
                  v-for="column in columns"
                  :key="column.name"
                  scope="col"
                  class="px-4 py-2 font-medium"
                >
                  {{ column.label }}
                </th>

                <th scope="col" class="px-4 py-2">
                  <span class="sr-only">{{ t('forms.admin.open') }}</span>
                </th>
              </tr>
            </thead>

            <tbody class="divide-default divide-y">
              <tr v-for="row in rows" :key="row.id" class="hover:bg-elevated">
                <td class="px-4 py-2 whitespace-nowrap">
                  {{ when(row.createdAt) }}
                </td>

                <td
                  v-for="column in columns"
                  :key="column.name"
                  class="max-w-64 truncate px-4 py-2"
                >
                  {{ show(row.values[column.name]) }}
                </td>

                <td class="px-4 py-2 text-right">
                  <UButton
                    :label="t('forms.admin.open')"
                    size="xs"
                    color="neutral"
                    variant="outline"
                    @click="active = row"
                  />
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <div v-if="total > PAGE_SIZE" class="flex justify-center">
          <UPagination
            v-model:page="page"
            :items-per-page="PAGE_SIZE"
            :total="total"
          />
        </div>
      </template>
    </div>

    <USlideover
      v-model:open="open"
      :title="t('forms.admin.detail')"
      :description="active ? when(active.createdAt) : undefined"
    >
      <template #body>
        <dl v-if="active" class="flex flex-col gap-y-4 text-sm">
          <div v-for="field in fields" :key="field.name">
            <dt class="text-muted">
              {{ field.label }}
            </dt>

            <dd class="font-medium whitespace-pre-wrap">
              {{ show(active.values[field.name]) || '-' }}
            </dd>
          </div>
        </dl>
      </template>

      <template #footer>
        <div v-if="!confirming" class="flex">
          <UButton
            :label="t('forms.admin.delete')"
            icon="i-lucide-trash-2"
            color="error"
            variant="outline"
            @click="confirming = true"
          />
        </div>

        <div v-else class="flex flex-col gap-y-2">
          <p class="text-sm">
            {{ t('forms.admin.deleteConfirm') }}
          </p>

          <div class="flex gap-x-2">
            <UButton
              :label="t('forms.admin.deleteYes')"
              :loading="deleting"
              color="error"
              @click="remove"
            />

            <UButton
              :label="t('forms.admin.cancel')"
              color="neutral"
              variant="ghost"
              @click="confirming = false"
            />
          </div>
        </div>
      </template>
    </USlideover>
  </PlutoViewAdminPanel>
</template>
