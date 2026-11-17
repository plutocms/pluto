<script setup lang="ts">
interface Props {
  siteKey: string
}

interface TurnstileApi {
  render: (
    element: HTMLElement,
    options: {
      sitekey: string
      callback: (token: string) => void
      'expired-callback': () => void
      'error-callback': () => void
    }
  ) => string
  remove: (id: string) => void
}

const props = defineProps<Props>()

const emit = defineEmits<{
  'update:modelValue': [token: string]
}>()

const SCRIPT_URL =
  'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit'

const element = ref<HTMLElement | null>(null)

let widget = ''

function api(): TurnstileApi | undefined {
  return (window as unknown as { turnstile?: TurnstileApi }).turnstile
}

function load(): Promise<void> {
  if (api()) {
    return Promise.resolve()
  }
  return new Promise((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(
      `script[src="${SCRIPT_URL}"]`
    )
    const script = existing ?? document.createElement('script')
    script.addEventListener('load', () => resolve(), { once: true })
    script.addEventListener('error', () => reject(new Error('turnstile')), {
      once: true,
    })
    if (!existing) {
      script.src = SCRIPT_URL
      script.async = true
      document.head.append(script)
    }
  })
}

onMounted(async () => {
  try {
    await load()
  } catch {
    return
  }
  if (!element.value) {
    return
  }
  widget =
    api()?.render(element.value, {
      sitekey: props.siteKey,
      callback: (token) => emit('update:modelValue', token),
      'expired-callback': () => emit('update:modelValue', ''),
      'error-callback': () => emit('update:modelValue', ''),
    }) ?? ''
})

onBeforeUnmount(() => {
  if (widget) {
    api()?.remove(widget)
  }
})
</script>

<template>
  <div ref="element" class="pluto-form__turnstile" />
</template>
