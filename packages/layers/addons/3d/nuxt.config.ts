// The 3D add-on layer. Add it next to the backend layer of the app:
// `extends: [plutoLayer('@plutocms/supabase-shop'), '@plutocms/3d']`. It does not
// extend `@plutocms/core` itself: the backend layer brings core, so core loads once.
export default defineNuxtConfig({
  $meta: {
    name: '3d',
  },

  runtimeConfig: {
    public: {
      // The media library of core takes 3D models (`.glb`) with this layer. A model can be
      // larger than a photo: 25 MB keeps a GitHub commit well under the size of a request.
      plutoMedia: {
        extraTypes: ['model/gltf-binary'],
        typeLimits: { 'model/gltf-binary': 25 * 1024 * 1024 },
      },
    },
  },

  // three.js loads in the browser only, on the pages that show a model.
  build: {
    transpile: ['three'],
  },
})
