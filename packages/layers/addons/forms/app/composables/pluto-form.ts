import type { MaybeRefOrGetter } from 'vue'
import type {
  PlutoFormErrors,
  PlutoFormFieldTypeInput,
  PlutoPublicForm,
} from '../../shared/types/forms'
import { computed, nextTick, onMounted, reactive, ref, toValue, watch } from 'vue'

interface PlutoFormAnswer {
  ok: boolean
  message?: string
  code?: string
  redirect?: string
  errors?: PlutoFormErrors
}

export type PlutoFormStatus = 'idle' | 'submitting' | 'success' | 'error'

const CODE_MESSAGES: Record<string, string> = {
  'rate-limit': 'forms.status.rateLimit',
  'token': 'forms.status.token',
  'turnstile': 'forms.status.turnstile',
  'no-store': 'forms.status.unavailable',
  'no-secret': 'forms.status.unavailable',
  'not-found': 'forms.status.unavailable',
  'too-large': 'forms.status.tooLarge',
}

/**
 * A form for a headless render: its fields, the values, the errors, the status and `submit()`.
 * It validates in the browser with the same rules as the server. Bind `values[field.name]` to
 * your inputs, `honeypot` to a hidden input that a visitor never fills, and call `submit()`.
 * `<PlutoForm>` is the default markup, made with this composable.
 *
 * @example
 * const { fields, values, errors, status, message, submit } = usePlutoForm('contact')
 *
 * @see https://pluto.vulmix.dev/docs/build/forms
 */
export function usePlutoForm(handle: MaybeRefOrGetter<string>) {
  const name = computed(() => toValue(handle))
  const { t: translate } = usePlutoSiteI18n()
  const t = translate as unknown as (
    key: string,
    params?: Record<string, unknown>
  ) => string

  const fetched = useFetch<PlutoPublicForm>(
    () => `/api/pluto/v1/forms/${name.value}`,
    { key: computed(() => `pluto-form:${name.value}`) }
  )

  const { data: definition, error: loadError } = fetched

  const fields = computed(() => definition.value?.fields ?? [])
  const values = reactive<Record<string, unknown>>({})
  const codes = ref<PlutoFormErrors>({})
  const status = ref<PlutoFormStatus>('idle')
  const message = ref('')
  const honeypot = ref('')
  const token = ref('')
  const turnstileToken = ref('')
  const turnstileSiteKey = ref<string | null>(null)
  const turnstileKey = ref(0)
  const summary = ref<HTMLElement | null>(null)

  const customTypes = computed(
    () =>
      (
        useAppConfig().plutoForms as
          | { fieldTypes?: PlutoFormFieldTypeInput[] }
          | undefined
      )?.fieldTypes
  )

  function reset() {
    for (const key of Object.keys(values)) {
      delete values[key]
    }
    for (const field of fields.value) {
      if (field.type === 'checkbox' || field.type === 'consent') {
        values[field.name] = false
      } else if (field.type === 'hidden') {
        values[field.name] = field.value ?? ''
      } else {
        values[field.name] = ''
      }
    }
    codes.value = {}
    honeypot.value = ''
  }

  watch(fields, reset, { immediate: true })

  const errors = computed<Record<string, string>>(() => {
    const result: Record<string, string> = {}
    for (const [key, code] of Object.entries(codes.value)) {
      const field = fields.value.find((one) => one.name === key)
      const { key: messageKey, params } = plutoFormErrorMessage(field, code)
      result[key] = messageKey ? t(messageKey, params) : code
    }
    return result
  })

  const errorList = computed(() =>
    Object.entries(errors.value).map(([field, text]) => ({ field, text }))
  )

  async function loadToken() {
    try {
      const answer = await $fetch<{
        token: string
        turnstileSiteKey: string | null
      }>(`/api/pluto/v1/forms/${name.value}/token`)
      token.value = answer.token
      turnstileSiteKey.value = answer.turnstileSiteKey
    } catch {
      token.value = ''
    }
  }

  onMounted(loadToken)

  async function focusSummary() {
    await nextTick()
    summary.value?.focus()
  }

  function show(code: string, text: string | undefined) {
    const key = CODE_MESSAGES[code]
    message.value = key ? t(key) : text || t('forms.status.failed')
  }

  async function submit() {
    if (!definition.value || status.value === 'submitting') {
      return
    }
    message.value = ''

    const { values: clean, errors: found } = plutoValidateForm(
      fields.value,
      { ...values },
      { custom: plutoFormCustomTypes(customTypes.value).validators }
    )
    if (Object.keys(found).length > 0) {
      codes.value = found
      status.value = 'error'
      await focusSummary()
      return
    }
    codes.value = {}

    if (!token.value) {
      await loadToken()
    }

    status.value = 'submitting'
    try {
      const answer = await $fetch<PlutoFormAnswer>(
        `/api/pluto/v1/forms/${name.value}/submissions`,
        {
          method: 'POST',
          body: {
            values: clean,
            token: token.value,
            hp: honeypot.value,
            turnstile: turnstileToken.value || undefined,
          },
        }
      )
      status.value = 'success'
      message.value = answer.message ?? definition.value.successMessage
      reset()
      const target = plutoFormRedirect(answer.redirect)
      if (target) {
        await navigateTo(target, { external: /^https?:/i.test(target) })
      }
    } catch (error) {
      const data = (error as { data?: PlutoFormAnswer }).data
      status.value = 'error'
      if (data?.errors && Object.keys(data.errors).length > 0) {
        codes.value = data.errors
        await focusSummary()
        return
      }
      show(data?.code ?? 'error', data?.message)
      if (data?.code === 'token' || data?.code === 'turnstile') {
        turnstileToken.value = ''
        turnstileKey.value++
        await loadToken()
      }
    }
  }

  return {
    ready: fetched.then(() => undefined),
    definition,
    loadError,
    fields,
    values,
    errors,
    errorList,
    status,
    message,
    submit,
    reset,
    honeypot,
    summary,
    turnstile: { siteKey: turnstileSiteKey, token: turnstileToken, key: turnstileKey },
  }
}
