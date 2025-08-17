export default defineAppConfig({
  ui: {
    button: {
      compoundVariants: [
        {
          size: 'xl',
          class: 'px-6 py-2',
          square: false,
        },
      ],

      defaultVariants: {
        color: 'primary',
        variant: 'solid',
        size: 'xl',
      },
    },

    input: {
      defaultVariants: {
        size: 'xl',
      },
    },
  },
})
