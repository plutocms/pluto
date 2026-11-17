<script setup lang="ts">
import type { PlutoFormField } from '../../shared/types/forms'

interface Props {
  handle: string
}

const props = defineProps<Props>()

const { t } = usePlutoSiteI18n()

const form = usePlutoForm(() => props.handle)

const base = `pluto-form-${props.handle}-${useId()}`

const custom = (
  useAppConfig().plutoForms as
    | {
        fieldTypes?: Array<{ name: string; component?: string }>
      }
    | undefined
)?.fieldTypes

const components: Record<string, unknown> = {
  text: resolveComponent('PlutoFormInput'),
  email: resolveComponent('PlutoFormInput'),
  tel: resolveComponent('PlutoFormInput'),
  url: resolveComponent('PlutoFormInput'),
  number: resolveComponent('PlutoFormInput'),
  date: resolveComponent('PlutoFormInput'),
  textarea: resolveComponent('PlutoFormTextarea'),
  select: resolveComponent('PlutoFormSelect'),
  radio: resolveComponent('PlutoFormRadio'),
  checkbox: resolveComponent('PlutoFormCheckbox'),
  consent: resolveComponent('PlutoFormConsent'),
  hidden: resolveComponent('PlutoFormHidden'),
}

for (const type of custom ?? []) {
  if (type.component) {
    components[type.name] = resolveComponent(type.component)
  }
}

const FormSubmit = resolveComponent('PlutoFormSubmit')

const visible = computed(() =>
  form.fields.value.filter((field) => field.type !== 'hidden')
)

const hidden = computed(() =>
  form.fields.value.filter((field) => field.type === 'hidden')
)

function idOf(field: PlutoFormField): string {
  return `${base}-${field.name}`
}

function componentOf(field: PlutoFormField) {
  return components[field.type] ?? components.text
}

function focusField(name: string) {
  document.getElementById(`${base}-${name}`)?.focus()
}

await form.ready
</script>

<template>
  <form
    v-if="form.definition.value"
    :class="`pluto-form--${props.handle}`"
    :aria-labelledby="`${base}-title`"
    class="pluto-form"
    novalidate
    @submit.prevent="form.submit()"
  >
    <span :id="`${base}-title`" class="pluto-form__title">
      {{ form.definition.value.title }}
    </span>

    <div
      :ref="(element) => (form.summary.value = element as HTMLElement | null)"
      :hidden="form.errorList.value.length === 0"
      :aria-labelledby="`${base}-summary`"
      class="pluto-form__summary"
      tabindex="-1"
      role="group"
    >
      <template v-if="form.errorList.value.length > 0">
        <p :id="`${base}-summary`" class="pluto-form__summary-title">
          {{ t('forms.summary.title') }}
        </p>

        <ul class="pluto-form__summary-list">
          <li v-for="item in form.errorList.value" :key="item.field">
            <a :href="`#${base}-${item.field}`" @click.prevent="focusField(item.field)">
              {{ item.text }}
            </a>
          </li>
        </ul>
      </template>
    </div>

    <div v-if="form.status.value !== 'success'" class="pluto-form__fields">
      <component
        :is="componentOf(field)"
        v-for="field in visible"
        :id="idOf(field)"
        :key="field.name"
        v-model="form.values[field.name]"
        :field="field"
        :error="form.errors.value[field.name]"
        :disabled="form.status.value === 'submitting'"
      />

      <component
        :is="componentOf(field)"
        v-for="field in hidden"
        :id="idOf(field)"
        :key="field.name"
        :model-value="form.values[field.name]"
        :field="field"
      />

      <div class="pluto-form__hp" aria-hidden="true">
        <label>
          {{ t('forms.honeypot') }}

          <input
            v-model="form.honeypot.value"
            type="text"
            name="hp"
            tabindex="-1"
            autocomplete="off"
          />
        </label>
      </div>

      <PlutoFormTurnstile
        v-if="form.turnstile.siteKey.value"
        :key="form.turnstile.key.value"
        v-model="form.turnstile.token.value"
        :site-key="form.turnstile.siteKey.value"
      />

      <component
        :is="FormSubmit"
        :label="form.definition.value.submitLabel"
        :pending="form.status.value === 'submitting'"
      />
    </div>

    <div
      :class="{
        'pluto-form__result--success': form.status.value === 'success',
        'pluto-form__result--error': form.status.value === 'error' && form.message.value,
      }"
      class="pluto-form__result"
      role="status"
      aria-live="polite"
      aria-atomic="true"
    >
      {{ form.message.value }}
    </div>
  </form>

  <p v-else-if="form.loadError.value" class="pluto-form__result pluto-form__result--error">
    {{ t('forms.status.unavailable') }}
  </p>
</template>
