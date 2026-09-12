// Registers core's own Home and Settings anchors. `order: 0` and
// `order: 1000` are reserved for these two entries, so every other layer's
// nav item sorts between them by default (default order is 100).
export default defineNuxtPlugin(() => {
  definePlutoExtension({
    id: 'pluto',
    nav: [
      { id: 'home', order: 0, label: 'Home', icon: 'lucide:house', to: '/admin/home' },
      { id: 'settings', order: 1000, label: 'Settings', icon: 'lucide:settings', to: '/admin/settings' },
    ],
    pages: [
      { id: 'home', path: '/admin/home', title: 'Dashboard', icon: 'lucide:house' },
      { id: 'settings', path: '/admin/settings', title: 'Settings', icon: 'lucide:settings' },
    ],
  })
})
