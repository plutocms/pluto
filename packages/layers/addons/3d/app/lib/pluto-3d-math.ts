/**
 * The distance from the center of a model at which a sphere of `radius` fits
 * in the view of a camera, with a margin. It uses the smaller of the vertical
 * and the horizontal field of view, so a model fits in a tall view too. Pure.
 */
export function fitDistance(
  radius: number,
  fovDegrees: number,
  aspect: number,
  margin = 1.15
): number {
  const vertical = (fovDegrees * Math.PI) / 180
  const horizontal = 2 * Math.atan(Math.tan(vertical / 2) * aspect)
  const fov = Math.min(vertical, horizontal)
  return (Math.max(radius, 1e-6) * margin) / Math.sin(fov / 2)
}

/** The direction of the camera: a three-quarter view from the front, a little from above. */
export const VIEW_DIRECTION = [0.6, 0.35, 1] as const
