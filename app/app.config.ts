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

    formField: {
      defaultVariants: {
        size: 'xl',
      },
    },

    input: {
      slots: {
        root: 'w-full',
      },

      compoundVariants: [
        {
          class: 'w-full',
        },
      ],

      defaultVariants: {
        size: 'xl',
      },
    },
  },
})
