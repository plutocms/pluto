export default defineTask({
  meta: {
    name: 'pluto:publish:scheduled',
    description: 'Publishes the scheduled items whose time has come.',
  },
  async run() {
    return { result: await publishScheduledContent() }
  },
})
