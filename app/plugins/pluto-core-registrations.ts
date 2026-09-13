import PlutoFieldBoolean from '../components/Pluto/Content/fields/PlutoFieldBoolean.vue'
import PlutoFieldDate from '../components/Pluto/Content/fields/PlutoFieldDate.vue'
import PlutoFieldNumber from '../components/Pluto/Content/fields/PlutoFieldNumber.vue'
import PlutoFieldReference from '../components/Pluto/Content/fields/PlutoFieldReference.vue'
import PlutoFieldSelect from '../components/Pluto/Content/fields/PlutoFieldSelect.vue'
import PlutoFieldSlug from '../components/Pluto/Content/fields/PlutoFieldSlug.vue'
import PlutoFieldText from '../components/Pluto/Content/fields/PlutoFieldText.vue'

// Registers core's own Home and Settings anchors, plus the eight built-in
// content field widgets. `order: 0` and `order: 1000` are reserved for the
// Home/Settings nav entries, so every other layer's nav item sorts between
// them by default (default order is 100).
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
      { id: 'home', order: 0, label: 'Home', icon: 'lucide:house', to: '/admin/home' },
      { id: 'settings', order: 1000, label: 'Settings', icon: 'lucide:settings', to: '/admin/settings' },
    ],
    pages: [
      { id: 'home', path: '/admin/home', title: 'Dashboard', icon: 'lucide:house' },
      { id: 'settings', path: '/admin/settings', title: 'Settings', icon: 'lucide:settings' },
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
  })
})
