<script setup lang="ts">
// One numbered step of the Email setup. It draws the card, the number and the
// state badge. The step content goes in the default slot.
const props = withDefaults(
  defineProps<{
    number: number
    title: string
    description?: string
    /** `todo`: do this next. `done`: finished. `locked`: an earlier step is missing. `optional`: you can skip it. */
    state?: 'todo' | 'done' | 'locked' | 'optional'
  }>(),
  { state: 'todo' }
)

const { t } = usePlutoI18n()

const badge = computed(() => {
  switch (props.state) {
    case 'done':
      return { label: t('pluto.mail.step.done'), color: 'success' as const }
    case 'locked':
      return { label: t('pluto.mail.step.locked'), color: 'neutral' as const }
    case 'optional':
      return { label: t('pluto.mail.step.optional'), color: 'neutral' as const }
    default:
      return { label: t('pluto.mail.step.todo'), color: 'primary' as const }
  }
})
</script>

<template>
  <UCard :class="{ 'opacity-70': state === 'locked' }">
    <template #header>
      <div class="flex items-start gap-3">
        <span
          class="bg-elevated text-highlighted flex size-7 shrink-0 items-center justify-center rounded-full text-sm font-semibold"
          aria-hidden="true"
        >
          <UIcon
            v-if="state === 'done'"
            name="lucide:check"
            class="text-success size-4"
          />
          <template v-else>{{ number }}</template>
        </span>

        <div class="min-w-0 flex-1">
          <h2 class="font-semibold">
            {{ title }}
          </h2>
          <p v-if="description" class="text-muted text-sm">
            {{ description }}
          </p>
        </div>

        <UBadge
          :label="badge.label"
          :color="badge.color"
          variant="subtle"
          size="sm"
        />
      </div>
    </template>

    <div class="flex flex-col gap-y-4">
      <slot />
    </div>
  </UCard>
</template>
