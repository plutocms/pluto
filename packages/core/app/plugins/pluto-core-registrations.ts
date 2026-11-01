// Every component loads on demand. Core's renderers show a skeleton for each
// one while its chunk loads (see PlutoSkeletonField and PlutoSkeletonWidget).
const PlutoFieldBoolean = defineAsyncComponent(
  () => import('../components/Pluto/Content/fields/PlutoFieldBoolean.vue')
)
const PlutoFieldDate = defineAsyncComponent(
  () => import('../components/Pluto/Content/fields/PlutoFieldDate.vue')
)
const PlutoFieldNumber = defineAsyncComponent(
  () => import('../components/Pluto/Content/fields/PlutoFieldNumber.vue')
)
const PlutoFieldReference = defineAsyncComponent(
  () => import('../components/Pluto/Content/fields/PlutoFieldReference.vue')
)
const PlutoFieldSelect = defineAsyncComponent(
  () => import('../components/Pluto/Content/fields/PlutoFieldSelect.vue')
)
const PlutoFieldSlug = defineAsyncComponent(
  () => import('../components/Pluto/Content/fields/PlutoFieldSlug.vue')
)
const PlutoFieldText = defineAsyncComponent(
  () => import('../components/Pluto/Content/fields/PlutoFieldText.vue')
)
const PlutoFieldMedia = defineAsyncComponent(
  () => import('../components/Pluto/Content/fields/PlutoFieldMedia.vue')
)
// The post editor (canvas layout): by widget name only, so it never replaces the
// `richtext` widget of a field that does not ask for it.
const PlutoFieldPostCanvas = defineAsyncComponent(
  () => import('../components/Pluto/Post/PlutoFieldPostCanvas.vue')
)
const PlutoDashboardContentActivity = defineAsyncComponent(
  () =>
    import('../components/Pluto/Dashboard/PlutoDashboardContentActivity.vue')
)
const PlutoDashboardContentOverview = defineAsyncComponent(
  () =>
    import('../components/Pluto/Dashboard/PlutoDashboardContentOverview.vue')
)
const PlutoDashboardQuickActions = defineAsyncComponent(
  () => import('../components/Pluto/Dashboard/PlutoDashboardQuickActions.vue')
)
const PlutoContentBarActions = defineAsyncComponent(
  () => import('../components/Pluto/Content/PlutoContentBarActions.vue')
)

// Registers core's own Home and Settings anchors, plus the eight built-in
// content field widgets. `order: 0` and `order: 1000` are reserved for the
// Home/Settings nav entries, so every other layer's nav item sorts between
// them by default (default order is 100).
//
// Labels and titles are translation keys, not English text. The consumer
// composables resolve them with `tx()`. See the i18n skill.
//
// Everything core itself contributes to the registry lives in this one
// `definePlutoExtension` call — `definePlutoExtension` replaces a layer's
// whole contribution on every call, not just the buckets that call passes,
// so a second `id: 'pluto'` call elsewhere would silently wipe this one out.
//
// `richtext` has no core widget here on purpose — a layer registers it (the
// Git CMS, the blog). `media` has the core widget: the picker of the core
// media library, for every backend (see the media skill).
//
// The Media page and its menu item show only when a backend has a media
// driver (`runtimeConfig.public.plutoMedia.driver`).
export default defineNuxtPlugin(() => {
  const mediaEnabled = usePlutoMedia().enabled

  definePlutoExtension({
    id: 'pluto',
    capabilities: [
      {
        id: 'media-manage',
        key: 'media:manage',
        label: 'pluto.media.capabilities.manage',
      },
      {
        id: 'media-delete',
        key: 'media:delete',
        label: 'pluto.media.capabilities.delete',
      },
    ],
    nav: [
      {
        id: 'home',
        order: 0,
        label: 'pluto.nav.home',
        icon: 'lucide:house',
        to: '/admin/home',
      },
      ...(mediaEnabled
        ? [
            {
              id: 'media',
              order: 900,
              label: 'pluto.nav.media',
              icon: 'lucide:images',
              to: '/admin/media',
            },
          ]
        : []),
      {
        id: 'settings',
        order: 1000,
        label: 'pluto.nav.settings',
        icon: 'lucide:settings',
        to: '/admin/settings',
      },
    ],
    pages: [
      {
        id: 'home',
        path: '/admin/home',
        title: 'pluto.pages.dashboard',
        icon: 'lucide:house',
      },
      {
        id: 'media',
        path: '/admin/media',
        title: 'pluto.pages.media',
        icon: 'lucide:images',
      },
      {
        id: 'settings',
        path: '/admin/settings',
        title: 'pluto.pages.settings',
        icon: 'lucide:settings',
      },
    ],
    // The General tab holds the settings panels and the language card. A layer
    // adds a tab with a file at `pages/admin/settings/<x>.vue` and an entry here.
    settingsPages: [
      {
        id: 'general',
        order: 0,
        label: 'pluto.settings.tabs.general',
        icon: 'lucide:sliders-horizontal',
        to: '/admin/settings',
      },
      // Admin only ('*'). The page and its routes (`/api/_pluto/mail/**`) check it.
      {
        id: 'email',
        order: 200,
        label: 'pluto.settings.tabs.email',
        icon: 'lucide:mail',
        to: '/admin/settings/email',
        capability: '*',
      },
    ],
    // The kinds of files that core knows. A layer adds its own (the 3D add-on adds 3D models).
    mediaKinds: [
      {
        id: 'image',
        order: 0,
        accept: ['image/*'],
        label: 'pluto.media.kinds.image',
        icon: 'lucide:image',
      },
      {
        id: 'pdf',
        order: 10,
        accept: ['application/pdf'],
        label: 'pluto.media.kinds.document',
        icon: 'lucide:file-text',
        badge: 'PDF',
      },
    ],
    contentFieldWidgets: [
      { id: 'text', fieldType: 'text', component: PlutoFieldText },
      { id: 'textarea', fieldType: 'textarea', component: PlutoFieldText },
      { id: 'slug', fieldType: 'slug', component: PlutoFieldSlug },
      { id: 'number', fieldType: 'number', component: PlutoFieldNumber },
      { id: 'boolean', fieldType: 'boolean', component: PlutoFieldBoolean },
      { id: 'date', fieldType: 'date', component: PlutoFieldDate },
      { id: 'select', fieldType: 'select', component: PlutoFieldSelect },
      {
        id: 'reference',
        fieldType: 'reference',
        component: PlutoFieldReference,
      },
      { id: 'media', fieldType: 'media', component: PlutoFieldMedia },
      {
        id: 'post-canvas',
        widget: 'post-canvas',
        component: PlutoFieldPostCanvas,
      },
    ],
    // `order: 0` puts the content overview first. It spans the full row
    // because it lays out its own grid of tiles. It is disabled while no
    // content type is registered, so the dashboard shows its own empty
    // message instead of a blank cell.
    dashboardWidgets: [
      {
        id: 'content-overview',
        order: 0,
        title: 'pluto.dashboard.overview.title',
        colSpan: 3,
        component: PlutoDashboardContentOverview,
        enabled: () => usePlutoContentTypes().items.value.length > 0,
      },
      // The activity chart and the quick actions share the next row (2 + 1
      // columns). A layer widget with the default order (100) goes below.
      {
        id: 'content-activity',
        order: 10,
        title: 'pluto.dashboard.activity.title',
        colSpan: 2,
        component: PlutoDashboardContentActivity,
        enabled: () => usePlutoContentTypes().items.value.length > 0,
      },
      {
        id: 'quick-actions',
        order: 20,
        title: 'pluto.dashboard.quickActions.title',
        colSpan: 1,
        component: PlutoDashboardQuickActions,
      },
    ],
    // The groups of content types in the sidebar and the admin bar. A type names one
    // with `navGroup`. Order 100 puts the group with the content items.
    navGroups: [
      {
        id: 'pages',
        order: 100,
        label: 'pluto.nav.pages',
        icon: 'i-lucide-book-open',
      },
    ],
    // "New <type>" and "Edit <type>" for the content types that set `adminBar`.
    navbarActions: [
      { id: 'content', order: 50, component: PlutoContentBarActions },
    ],
  })
})
