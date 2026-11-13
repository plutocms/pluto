export const contactType = defineContentType({
  name: 'contact',
  label: 'Contact info',
  labelPlural: 'Contact info',
  icon: 'lucide:contact',
  source: 'settings',
  titleField: 'email',
  singleton: true,
  status: false,
  adminBar: { edit: true },
  api: {
    public: true,
  },
  fields: [
    {
      name: 'email',
      type: 'text',
      label: 'Email',
      required: true,
    },
    {
      name: 'phone',
      type: 'text',
      label: 'Phone',
    },
    {
      name: 'address',
      type: 'textarea',
      label: 'Address',
    },
  ],
})
