<script setup lang="ts">
// A toolbar item of the edit form (`contentToolbarItems`). It shows the build
// of the head commit of the content branch: a spinner while the site builds,
// a check mark when it is live, and an error icon when the build failed. The
// Info button opens the details, with a link to each Action or build.
// The CMS plugin registers it only for GitHub storage with `skipDeploy` off.
// A type with `liveOnSave` shows a save at once: "Live" right after the save, a
// small spinner by the Info button while the static build runs, and a warning
// in the popover when that build fails (the site then serves the change at run time).
import type {
  PlutoBuildItem,
  PlutoBuildState,
} from '../../../../modules/pluto-github/runtime/shared/build-status'
import { usePlutoGithubBuildStatus } from '../../../../modules/pluto-github/runtime/app/composables/pluto-github-build-status'
import { savedAgo } from '../../../composables/internal/content-dirty'

const { t, locale } = usePlutoI18n()
const form = usePlutoContentForm()
const { status, check, afterSave } = usePlutoGithubBuildStatus()

// Read when the edit page opens, and after each save. A new item has no commit yet:
// the form goes to the edit page after the first save, and this item mounts again there.
onMounted(() => {
  if (form?.editing.value) {
    check()
  }
})
// True after a save in this page. With `liveOnSave` the change is live from then on.
const savedHere = ref(false)
form?.onSaved(() => {
  savedHere.value = true
  afterSave()
})

const state = computed<PlutoBuildState>(() => status.value?.state ?? 'none')
const liveOnSave = computed(() => form?.type.value?.liveOnSave === true)
/** The static build runs, and the site already serves the change. */
const staticBuilding = computed(
  () => liveOnSave.value && state.value === 'pending'
)
/** The static build failed, and the site serves the change at run time. */
const staticFailed = computed(
  () => liveOnSave.value && state.value === 'failure'
)

const summary = computed(() => {
  if (liveOnSave.value) {
    // Live at once after a save. On open, live as soon as a build is known.
    return savedHere.value || state.value !== 'none'
      ? {
          label: t('pluto.github.build.live'),
          icon: 'i-lucide-check',
          iconClass: 'text-success',
          textClass: 'text-muted',
        }
      : undefined
  }
  switch (state.value) {
    case 'pending':
      return {
        label: t('pluto.github.build.publishing'),
        icon: 'i-lucide-loader-circle',
        iconClass: 'text-muted animate-spin',
        textClass: 'text-muted',
      }
    case 'success':
      return {
        label: t('pluto.github.build.live'),
        icon: 'i-lucide-check',
        iconClass: 'text-success',
        textClass: 'text-muted',
      }
    case 'failure':
      return {
        label: t('pluto.github.build.failed'),
        icon: 'i-lucide-circle-x',
        iconClass: 'text-error',
        textClass: 'text-error',
      }
    default:
      return undefined
  }
})

const itemIcons = {
  pending: { icon: 'i-lucide-loader-circle', class: 'text-muted animate-spin' },
  success: { icon: 'i-lucide-circle-check', class: 'text-success' },
  failure: { icon: 'i-lucide-circle-x', class: 'text-error' },
} as const

const relative = computed(
  () => new Intl.RelativeTimeFormat(locale.value, { numeric: 'auto' })
)

/** "2 minutes ago", or "just now". */
function ago(iso: string | undefined): string | undefined {
  if (!iso) {
    return undefined
  }
  const diff = Date.now() - Date.parse(iso)
  if (Number.isNaN(diff)) {
    return undefined
  }
  const result = savedAgo(diff)
  return result.unit === 'now'
    ? t('pluto.github.build.justNow')
    : relative.value.format(-result.value, result.unit)
}

function itemTime(item: PlutoBuildItem): string | undefined {
  if (item.state === 'pending') {
    const time = ago(item.startedAt)
    return time ? t('pluto.github.build.started', { time }) : undefined
  }
  const time = ago(item.completedAt ?? item.startedAt)
  return time ? t('pluto.github.build.finished', { time }) : undefined
}

function itemDetail(item: PlutoBuildItem): string {
  return [
    t(`pluto.github.build.item.${item.state}`),
    itemTime(item),
    item.description,
  ]
    .filter(Boolean)
    .join(' · ')
}

const commitTime = computed(() => ago(status.value?.committedAt))
</script>

<template>
  <div v-if="summary" class="flex items-center gap-1">
    <!-- A live region: a screen reader hears the change. -->
    <div
      role="status"
      aria-live="polite"
      class="flex items-center gap-1.5 text-sm"
    >
      <UIcon
        :name="summary.icon"
        :class="summary.iconClass"
        class="size-4 shrink-0"
        aria-hidden="true"
      />
      <span :class="summary.textClass" class="hidden md:inline">{{
        summary.label
      }}</span>
      <span class="sr-only md:hidden">{{ summary.label }}</span>
    </div>

    <!-- A small spinner by the Info button while the static build runs. -->
    <UIcon
      v-if="staticBuilding"
      :title="t('pluto.github.build.staticBuilding')"
      name="i-lucide-loader-circle"
      class="text-muted size-3.5 shrink-0 animate-spin"
      aria-hidden="true"
    />
    <span v-if="staticBuilding" class="sr-only" role="status">{{
      t('pluto.github.build.staticBuilding')
    }}</span>

    <UPopover v-if="status" :content="{ align: 'end' }">
      <UTooltip :text="t('pluto.github.build.details')">
        <UButton
          :aria-label="t('pluto.github.build.details')"
          :color="staticFailed ? 'warning' : 'neutral'"
          icon="lucide:info"
          variant="ghost"
          square
        />
      </UTooltip>

      <template #content>
        <div class="w-80 max-w-[calc(100vw-2rem)] p-3">
          <p class="text-highlighted text-sm font-medium">
            {{ t('pluto.github.build.title') }}
          </p>

          <p v-if="staticBuilding" class="text-muted mt-1 text-xs">
            {{ t('pluto.github.build.staticBuilding') }}
          </p>
          <p
            v-else-if="staticFailed"
            class="text-warning mt-1 flex items-start gap-1.5 text-xs"
          >
            <UIcon
              name="i-lucide-triangle-alert"
              class="mt-0.5 size-3.5 shrink-0"
              aria-hidden="true"
            />
            <span>{{ t('pluto.github.build.staticFailed') }}</span>
          </p>

          <div class="text-muted mt-1 text-xs">
            <span class="font-mono">{{ status.shortSha }}</span>
            <template v-if="status.message"> · {{ status.message }} </template>
            <template v-if="commitTime"> · {{ commitTime }} </template>
          </div>

          <ul class="divide-default mt-3 divide-y">
            <li
              v-for="item in status.items"
              :key="`${item.kind}:${item.name}`"
              class="flex items-start gap-2 py-2"
            >
              <UIcon
                :name="itemIcons[item.state].icon"
                :class="itemIcons[item.state].class"
                class="mt-0.5 size-4 shrink-0"
                aria-hidden="true"
              />
              <div class="min-w-0 flex-1">
                <p class="text-highlighted truncate text-sm">
                  {{ item.name }}
                </p>
                <p class="text-muted text-xs">
                  {{ itemDetail(item) }}
                </p>
              </div>
              <UButton
                v-if="item.url"
                :to="item.url"
                :label="
                  item.kind === 'check'
                    ? t('pluto.github.build.viewAction')
                    : t('pluto.github.build.viewBuild')
                "
                target="_blank"
                rel="noopener noreferrer"
                trailing-icon="lucide:external-link"
                color="neutral"
                variant="outline"
                size="xs"
                class="shrink-0"
              />
            </li>
          </ul>

          <p v-if="status.unavailable?.length" class="text-muted mt-2 text-xs">
            {{ t('pluto.github.build.unavailable') }}
          </p>
        </div>
      </template>
    </UPopover>
  </div>
</template>
