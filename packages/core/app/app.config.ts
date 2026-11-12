// Every UHeader of the site gets `pluto-header-offset`: while the admin bar shows to a signed-in
// editor, the header sticks under it with no change in the site (the rules are in the plain CSS of
// PlutoRoot). The admin has no UHeader. See the admin-shell skill.
export default defineAppConfig({
  ui: {
    header: {
      slots: {
        root: 'pluto-header-offset',
      },
    },
  },
})
