/**
 * `pluto:trash:purge`: deletes forever the items that are in the trash for more than 30 days, for
 * every content type with `trash`. Core runs it every day at 03:00 (`nitro.scheduledTasks` in the
 * core `nuxt.config.ts`) on a host that runs scheduled tasks: a Node, Bun or Deno server,
 * Cloudflare, Vercel. Opening a Trash purges too, so a host with no scheduled task is fine. It uses
 * a system request (`createPlutoSystemEvent`): the adapter needs its server credentials, or it skips
 * the type with a warning. See the content-model skill ("Trash").
 */
export default defineTask({
  meta: {
    name: 'pluto:trash:purge',
    description: 'Deletes forever the trashed items older than 30 days.',
  },
  async run() {
    return { result: await purgeExpiredTrash() }
  },
})
