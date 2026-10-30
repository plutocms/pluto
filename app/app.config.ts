export default defineAppConfig({
  ui: {
    // The admin sets the sizes and the fonts of its components in its own scope
    // (PlutoAdminTheme), not here: `app.config` reaches every public site too.
    // This padding applies only to an `xl` button with a label.
    button: {
      compoundVariants: [
        {
          size: 'xl',
          class: 'px-6 py-2',
          square: false,
        },
      ],
    },
  },
})
