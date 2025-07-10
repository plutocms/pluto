export default defineAppConfig({
  ui: {
    button: {
      compoundVariants: [
        {
          size: 'xl',
          class: 'px-6 py-2',
        },
      ],

      defaultVariants: {
        color: 'primary',
        variant: 'solid',
        size: 'xl',
      },
    },
  },
})
