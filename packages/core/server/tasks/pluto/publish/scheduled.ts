/**
 * `pluto:publish:scheduled`: sets the scheduled items whose time has come to published, for every
 * content type with `status.schedule`. Core runs it every 5 minutes (`nitro.scheduledTasks` in the
 * core `nuxt.config.ts`) on a host that runs scheduled tasks: a Node, Bun or Deno server,
 * Cloudflare (not Vercel or Netlify with Nitro 2). A server read shows a scheduled item at its time
 * already (`isLiveStatus`), and the admin list of a publisher publishes the due items too;
 * the task makes the stored status right and, on the Git CMS, makes the commit that starts a
 * deploy. It uses a system request (`createPlutoSystemEvent`): the adapter needs its server
 * credentials, or it skips the type with a warning. See the content-model skill ("Scheduled
 * publish and review").
 */
export default defineTask({
  meta: {
    name: 'pluto:publish:scheduled',
    description: 'Publishes the scheduled items whose time has come.',
  },
  async run() {
    return { result: await publishScheduledContent() }
  },
})
