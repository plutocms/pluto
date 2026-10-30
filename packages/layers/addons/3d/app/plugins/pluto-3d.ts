// The 3D add-on in the media library of core: the kind of a 3D model (`.glb`),
// with its viewer for the details of a file, and the preview image that the
// browser makes at upload. three.js loads on demand: the plugin itself imports
// none of it. See the 3d skill.
import { glbExternalFiles } from '../lib/pluto-3d-glb'

const Pluto3dViewer = defineAsyncComponent(
  () => import('../components/Pluto3dViewer.vue')
)

export default defineNuxtPlugin(() => {
  definePlutoExtension({
    id: '3d',
    mediaKinds: [
      {
        id: 'model',
        order: 20,
        accept: ['model/gltf-binary'],
        label: '3d.kind',
        icon: 'lucide:box',
        badge: '3D',
        viewer: Pluto3dViewer,
        createPreview: async (file) =>
          (await import('../lib/pluto-3d')).renderModelPreview(file),
        // A model that links textures it does not hold shows without them.
        inspect: async (file) =>
          glbExternalFiles(await file.arrayBuffer()).length
            ? '3d.externalFiles'
            : null,
      },
    ],
  })
})
