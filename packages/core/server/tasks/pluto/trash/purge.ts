export default defineTask({
  meta: {
    name: 'pluto:trash:purge',
    description: 'Deletes forever the trashed items older than 30 days.',
  },
  async run() {
    return { result: await purgeExpiredTrash() }
  },
})
