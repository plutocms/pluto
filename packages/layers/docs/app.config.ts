// Every UHeader of the site gets `pluto-header-offset`, so it stays under the admin bar of a
// signed-in editor with no change in the site (see the admin-bar-offset skill).
export default defineAppConfig({
  ui: {
    header: {
      slots: {
        root: 'pluto-header-offset',
      },
    },
  },
})
