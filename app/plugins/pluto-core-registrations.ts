import PlutoFieldBoolean from '../components/Pluto/Content/fields/PlutoFieldBoolean.vue'
import PlutoFieldDate from '../components/Pluto/Content/fields/PlutoFieldDate.vue'
import PlutoFieldNumber from '../components/Pluto/Content/fields/PlutoFieldNumber.vue'
import PlutoFieldReference from '../components/Pluto/Content/fields/PlutoFieldReference.vue'
import PlutoFieldSelect from '../components/Pluto/Content/fields/PlutoFieldSelect.vue'
import PlutoFieldSlug from '../components/Pluto/Content/fields/PlutoFieldSlug.vue'
import PlutoFieldText from '../components/Pluto/Content/fields/PlutoFieldText.vue'
import PlutoDashboardContentActivity from '../components/Pluto/Dashboard/PlutoDashboardContentActivity.vue'
import PlutoDashboardContentOverview from '../components/Pluto/Dashboard/PlutoDashboardContentOverview.vue'
import PlutoDashboardQuickActions from '../components/Pluto/Dashboard/PlutoDashboardQuickActions.vue'

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
// `richtext` and `media` have no core widget here on purpose — a layer
// registers those (blog registers `richtext`, storage registers `media`),
// because core has no real editor or file picker to offer for either. See
// the content-model skill.
export default defineNuxtPlugin(() => {
  definePlutoExtension({
    id: 'pluto',
    nav: [
      { id: 'home', order: 0, label: 'pluto.nav.home', icon: 'lucide:house', to: '/admin/home' },
      { id: 'settings', order: 1000, label: 'pluto.nav.settings', icon: 'lucide:settings', to: '/admin/settings' },
    ],
    pages: [
      { id: 'home', path: '/admin/home', title: 'pluto.pages.dashboard', icon: 'lucide:house' },
      { id: 'settings', path: '/admin/settings', title: 'pluto.pages.settings', icon: 'lucide:settings' },
    ],
    contentFieldWidgets: [
      { id: 'text', fieldType: 'text', component: PlutoFieldText },
      { id: 'textarea', fieldType: 'textarea', component: PlutoFieldText },
      { id: 'slug', fieldType: 'slug', component: PlutoFieldSlug },
      { id: 'number', fieldType: 'number', component: PlutoFieldNumber },
      { id: 'boolean', fieldType: 'boolean', component: PlutoFieldBoolean },
      { id: 'date', fieldType: 'date', component: PlutoFieldDate },
      { id: 'select', fieldType: 'select', component: PlutoFieldSelect },
      { id: 'reference', fieldType: 'reference', component: PlutoFieldReference },
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
  })
})
