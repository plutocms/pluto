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
        inspect: async (file) =>
          glbExternalFiles(await file.arrayBuffer()).length
            ? '3d.externalFiles'
            : null,
      },
    ],
  })
})
