<script setup lang="ts">
interface Props {
  name?: string
  role?: string
  image?: string
  align?: 'start' | 'center' | 'end'
}

const props = withDefaults(defineProps<Props>(), {
  name: '',
  role: undefined,
  image: undefined,
  align: undefined,
})

definePlutoBlock<Props>({
  label: 'Testimonial',
  description: 'A quote with the name, the role and the photo of the person.',
  icon: 'i-lucide-quote',
  group: 'landing',
  insert:
    '::block-testimonial{name="Ana Souza" role="Founder"}\nA short quote.\n::',
  props: {
    name: {
      type: 'string',
    },
    role: {
      type: 'string',
      description: 'The job or the company of the person.',
    },
    image: {
      type: 'media',
      description: 'The photo of the person.',
    },
  },
  slots: {
    default: {
      label: 'Quote',
      content: 'rich',
    },
  },
})

const baseURL = useRuntimeConfig().app.baseURL

const photo = computed(() => blocksUrl(props.image, baseURL))
</script>

<template>
  <figure :data-align="props.align" class="pluto-blocks-testimonial">
    <blockquote class="pluto-blocks-testimonial__quote">
      <slot />
    </blockquote>

    <figcaption v-if="props.name || props.role || photo">
      <img
        v-if="photo"
        :src="photo"
        alt=""
        loading="lazy"
        decoding="async"
        class="pluto-blocks-testimonial__photo"
      />

      <span class="pluto-blocks-testimonial__person">
        <strong v-if="props.name">{{ props.name }}</strong>
        <span v-if="props.role">{{ props.role }}</span>
      </span>
    </figcaption>
  </figure>
</template>
