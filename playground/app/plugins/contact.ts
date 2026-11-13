export default defineNuxtPlugin(() => {
  definePlutoExtension({
    id: 'playground',
    contentTypes: [
      {
        id: 'contact',
        type: contactType,
      },
    ],
  })
})
