<script setup lang="ts">
import type { ClassNameValue } from 'tailwind-merge'
import { useBodyScrollLock } from 'reka-ui'
import { twMerge } from 'tailwind-merge'

interface Props {
  size?: 'small' | 'medium' | 'large' | 'default'
  customSize?: number
  preventClickOutside?: boolean
  class?: ClassNameValue
  scrollAreaClass?: ClassNameValue
  backgroundClass?: ClassNameValue
}

defineOptions({
  inheritAttrs: false,
})

const props = withDefaults(defineProps<Props>(), {
  isOpen: false,
  preventClickOutside: false,
})

const emit = defineEmits(['update:isOpen', 'scroll'])

const scrollLock = useBodyScrollLock()

const scrollRef = useTemplateRef('scrollRef')

const { isScrolling, y } = useScroll(scrollRef)

const model = defineModel<boolean>()

const resolvedClasses = computed(() => {
  const defaultClasses = `
      group
      relative
      w-[936px] h-fit
      rounded-lg
      my-4 mx-4
      shadow-2xl
      bg-(--ui-bg)
      light:text-zinc-800 dark:text-white
    `

  return twMerge([
    defaultClasses,

    !props.customSize && props.size && props.size === 'small'
      ? 'w-[320px]'
      : null,

    !props.customSize && props.size && props.size === 'medium'
      ? 'w-[768px]'
      : null,

    !props.customSize && props.size && props.size === 'large'
      ? 'w-[1280px]'
      : null,

    !props.customSize && props.size && props.size === 'default'
      ? 'w-[936px]'
      : null,

    props.class,
  ])
})

const resolvedOverlayClasses = computed(() => {
  const defaultClasses = `
      pointer-events-auto
      fixed
      left-0 top-0
      z-[51]
      h-screen w-screen
      bg-black/90
    `

  return twMerge([defaultClasses])
})

watchEffect(() => {
  if (model.value === true) {
    scrollLock.value = true

    nextTick(() => {
      document.body.style.pointerEvents = ''
    })

    return
  }

  scrollLock.value = false
})

watch(y, (y) => {
  if (isScrolling.value) {
    emit('scroll', y)
  }
})

function closeModal() {
  model.value = false
}
</script>

<template>
  <Teleport to="body">
    <Transition name="fade">
      <div
        v-if="model === true"
        :class="resolvedOverlayClasses"
        @click="props.preventClickOutside === false ? closeModal() : null"
      >
        <div ref="scrollRef" class="h-full overflow-y-scroll py-4">
          <div class="flex min-h-full items-center justify-center">
            <div
              :class="twMerge(['modal-content my-auto', resolvedClasses])"
              :style="{
                width:
                  !props.size && props.customSize
                    ? `${props.customSize}px`
                    : '',
              }"
              v-bind="$attrs"
              @click.stop
            >
              <slot />
            </div>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.fade-enter-active {
  transition:
    transform 1000ms cubic-bezier(0.08, 0.915, 0.005, 0.985),
    opacity 250ms cubic-bezier(0.295, 0.485, 0, 0.975);
}

.fade-leave-active {
  transition: 300ms cubic-bezier(0.295, 0.485, 0, 0.975);
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

.fade-enter-active .modal-content,
.fade-leave-active .modal-content {
  transition: all 700ms cubic-bezier(0.08, 0.915, 0.005, 0.985);
}

.fade-enter-from .modal-content,
.fade-leave-to .modal-content {
  opacity: 0;
  transform: translateY(40px);
}
</style>
