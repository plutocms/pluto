<script setup lang="ts">
interface Props {
  label: string
  pending?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  pending: false,
})

const { t } = usePlutoSiteI18n()
</script>

<template>
  <div class="pluto-form__actions">
    <button
      :disabled="props.pending"
      :aria-disabled="props.pending ? 'true' : undefined"
      type="submit"
      class="pluto-form__submit"
    >
      {{ props.pending ? t('forms.status.sending') : props.label }}
    </button>
  </div>
</template>
