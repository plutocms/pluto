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

export const VIEW_DIRECTION = [0.6, 0.35, 1] as const
