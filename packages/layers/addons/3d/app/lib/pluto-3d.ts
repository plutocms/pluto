import type { Material, Object3D, Texture } from 'three'
import {
  ACESFilmicToneMapping,
  Box3,
  DirectionalLight,
  Mesh,
  PerspectiveCamera,
  PMREMGenerator,
  Scene,
  Sphere,
  SRGBColorSpace,
  Vector3,
  WebGLRenderer,
} from 'three'
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js'
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { fitDistance, VIEW_DIRECTION } from './pluto-3d-math'

// The three.js part of the 3D add-on: a stage (renderer, scene, soft studio
// light, camera), loading a model, framing it, and a static preview image.
// This file is imported on demand, in the browser only, so three.js stays out
// of the pages that show no model. See the 3d skill.

export interface PlutoStage {
  renderer: WebGLRenderer
  scene: Scene
  camera: PerspectiveCamera
  dispose: () => void
}

/** A renderer on `canvas`, with a transparent background and the light of a soft studio. */
export function createStage(
  canvas: HTMLCanvasElement,
  options: { preserveDrawingBuffer?: boolean } = {}
): PlutoStage {
  const renderer = new WebGLRenderer({
    canvas,
    antialias: true,
    alpha: true,
    preserveDrawingBuffer: options.preserveDrawingBuffer ?? false,
  })
  renderer.outputColorSpace = SRGBColorSpace
  renderer.toneMapping = ACESFilmicToneMapping
  // Under 1: a white material keeps its shades, and does not burn out.
  renderer.toneMappingExposure = 0.8
  renderer.setClearColor(0x000000, 0)

  const scene = new Scene()
  const pmrem = new PMREMGenerator(renderer)
  const environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture
  scene.environment = environment
  // Soft light from all sides, and a key light from the top left with the camera, so a
  // model with no texture still shows its shape.
  scene.environmentIntensity = 0.35

  const camera = new PerspectiveCamera(35, 1, 0.01, 1000)
  const key = new DirectionalLight(0xffffff, 1.6)
  key.position.set(-1, 2, 1.5)
  camera.add(key)
  scene.add(camera)

  return {
    renderer,
    scene,
    camera,
    dispose: () => {
      disposeObject(scene)
      environment.dispose()
      pmrem.dispose()
      renderer.dispose()
    },
  }
}

/** Loads a `.glb` model from a URL or from its bytes. Meshopt compression works; Draco does not. */
export async function loadModel(
  source: string | ArrayBuffer
): Promise<Object3D> {
  const loader = new GLTFLoader()
  loader.setMeshoptDecoder(MeshoptDecoder)
  const gltf =
    typeof source === 'string'
      ? await loader.loadAsync(source)
      : await loader.parseAsync(source, '')
  return gltf.scene
}

/** Puts the camera at a three-quarter view that fits the whole model. Returns the center. */
export function frameModel(
  camera: PerspectiveCamera,
  model: Object3D,
  aspect: number
): Vector3 {
  const sphere = new Box3().setFromObject(model).getBoundingSphere(new Sphere())
  const radius = Math.max(sphere.radius, 1e-3)
  const distance = fitDistance(radius, camera.fov, aspect)
  camera.aspect = aspect
  camera.near = distance / 100
  camera.far = distance * 100
  camera.position
    .copy(sphere.center)
    .addScaledVector(new Vector3(...VIEW_DIRECTION).normalize(), distance)
  camera.lookAt(sphere.center)
  camera.updateProjectionMatrix()
  return sphere.center.clone()
}

/** Frees the GPU memory of every mesh, material and texture under `object`. */
export function disposeObject(object: Object3D): void {
  object.traverse((child) => {
    if (!(child instanceof Mesh)) {
      return
    }
    child.geometry.dispose()
    const materials: Material[] = Array.isArray(child.material)
      ? child.material
      : [child.material]
    for (const material of materials) {
      for (const value of Object.values(material)) {
        if (value && typeof value === 'object' && 'isTexture' in value) {
          ;(value as Texture).dispose()
        }
      }
      material.dispose()
    }
  })
}

function canvasBlob(
  canvas: HTMLCanvasElement,
  type: string
): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, type, 0.85))
}

/**
 * A static preview image of a model: one frame of the stage, `size` px
 * square, transparent around the model. WebP, or PNG when the browser cannot
 * write WebP. The media library sends it with the upload. `null` when the
 * browser has no WebGL or the model does not load.
 */
export async function renderModelPreview(
  file: Blob,
  size = 1024
): Promise<Blob | null> {
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  let stage: PlutoStage
  try {
    stage = createStage(canvas, { preserveDrawingBuffer: true })
  } catch {
    return null
  }
  try {
    stage.renderer.setPixelRatio(1)
    stage.renderer.setSize(size, size, false)
    const model = await loadModel(await file.arrayBuffer())
    stage.scene.add(model)
    frameModel(stage.camera, model, 1)
    stage.renderer.render(stage.scene, stage.camera)
    const webp = await canvasBlob(canvas, 'image/webp')
    return webp?.type === 'image/webp'
      ? webp
      : await canvasBlob(canvas, 'image/png')
  } catch {
    return null
  } finally {
    stage.dispose()
  }
}
