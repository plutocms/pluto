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

  build: {
    transpile: ['three'],
  },
})
