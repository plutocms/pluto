import { describe, expect, it } from 'vitest'
import { fitDistance } from '../app/lib/pluto-3d-math'

describe('fitDistance', () => {
  it('fits a sphere in the vertical view of a wide camera', () => {
    // A 90° vertical view: the sphere touches the view at radius * margin / sin(45°).
    expect(fitDistance(1, 90, 2, 1)).toBeCloseTo(Math.SQRT2)
  })

  it('uses the horizontal view of a tall camera, so the model still fits', () => {
    expect(fitDistance(1, 90, 0.5, 1)).toBeGreaterThan(fitDistance(1, 90, 1, 1))
  })

  it('grows with the radius and the margin, and survives a model of no size', () => {
    expect(fitDistance(2, 35, 1)).toBeCloseTo(fitDistance(1, 35, 1) * 2)
    expect(fitDistance(1, 35, 1, 1.5)).toBeGreaterThan(fitDistance(1, 35, 1))
    expect(Number.isFinite(fitDistance(0, 35, 1))).toBe(true)
  })
})
