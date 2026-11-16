<script lang="ts">
export default defineComponent({
  name: 'BlockInline',
  setup(_props, { slots }) {
    return () => blocksUnwrapParagraphs(slots.default?.() ?? [])
  },
})
</script>
