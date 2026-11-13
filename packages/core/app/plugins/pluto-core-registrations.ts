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
const PlutoEmbedYoutube = defineAsyncComponent(
  () => import('../components/Pluto/Embed/PlutoEmbedYoutube.vue')
)
const PlutoEmbedVimeo = defineAsyncComponent(
  () => import('../components/Pluto/Embed/PlutoEmbedVimeo.vue')
)
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
const PlutoContentHistory = defineAsyncComponent(
  () => import('../components/Pluto/Content/PlutoContentHistory.vue')
)

export default defineNuxtPlugin(() => {
  const mediaEnabled = usePlutoMedia().enabled

  // One call only: `definePlutoExtension` replaces the whole contribution of an id on each call.
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
    settingsPages: [
      {
        id: 'general',
        order: 0,
        label: 'pluto.settings.tabs.general',
        icon: 'lucide:sliders-horizontal',
        to: '/admin/settings',
      },
      {
        id: 'email',
        order: 200,
        label: 'pluto.settings.tabs.email',
        icon: 'lucide:mail',
        to: '/admin/settings/email',
        capability: '*',
      },
    ],
    embedProviders: [
      {
        id: 'youtube',
        order: 10,
        label: 'YouTube',
        match: matchYoutubeUrl,
        component: PlutoEmbedYoutube,
      },
      {
        id: 'vimeo',
        order: 20,
        label: 'Vimeo',
        match: matchVimeoUrl,
        component: PlutoEmbedVimeo,
      },
    ],
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
    dashboardWidgets: [
      {
        id: 'content-overview',
        order: 0,
        title: 'pluto.dashboard.overview.title',
        colSpan: 3,
        component: PlutoDashboardContentOverview,
        enabled: () => usePlutoContentTypes().items.value.length > 0,
      },
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
    navGroups: [
      {
        id: 'pages',
        order: 100,
        label: 'pluto.nav.pages',
        icon: 'i-lucide-book-open',
      },
    ],
    navbarActions: [
      { id: 'content', order: 50, component: PlutoContentBarActions },
    ],
    contentToolbarItems: [
      {
        id: 'history',
        contentType: '*',
        order: 40,
        component: PlutoContentHistory,
      },
    ],
  })
})
