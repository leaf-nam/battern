import { describe, it, expect } from 'vitest'
import { dist, makeDefaultCurve, cubicPoint, curveLengthMm, findSnapTarget } from '../geometry.js'

describe('dist', () => {
  it('returns 0 for identical points', () => {
    expect(dist(0, 0, 0, 0)).toBe(0)
  })

  it('computes Euclidean distance', () => {
    expect(dist(0, 0, 3, 4)).toBe(5)
  })

  it('handles negative coordinates', () => {
    expect(dist(-1, -1, 2, 3)).toBe(5)
  })
})

describe('makeDefaultCurve', () => {
  it('returns c1x, c1y, c2x, c2y', () => {
    const c = makeDefaultCurve(0, 0, 100, 0)
    expect(c).toHaveProperty('c1x')
    expect(c).toHaveProperty('c1y')
    expect(c).toHaveProperty('c2x')
    expect(c).toHaveProperty('c2y')
  })

  it('generates a bow perpendicular to the line', () => {
    const horizontal = makeDefaultCurve(0, 0, 100, 0)
    expect(horizontal.c1y).toBeGreaterThan(0)
    expect(horizontal.c2y).toBeGreaterThan(0)

    const vertical = makeDefaultCurve(0, 0, 0, 100)
    expect(vertical.c1x).toBeLessThan(0)
    expect(vertical.c2x).toBeLessThan(0)
  })
})

describe('cubicPoint', () => {
  it('returns p0 at t=0', () => {
    expect(cubicPoint(0, 0, 10, 20, 30)).toBe(0)
  })

  it('returns p3 at t=1', () => {
    expect(cubicPoint(1, 0, 10, 20, 30)).toBe(30)
  })
})

describe('curveLengthMm', () => {
  it('returns ~100mm for a straight control polygon of length 100', () => {
    const s = { x1: 0, y1: 0, c1x: 33, c1y: 0, c2x: 66, c2y: 0, x2: 100, y2: 0 }
    const len = curveLengthMm(s)
    expect(len).toBeGreaterThan(95)
    expect(len).toBeLessThanOrEqual(100)
  })

  it('is longer for a bowed curve', () => {
    const straight = { x1: 0, y1: 0, c1x: 33, c1y: 0, c2x: 66, c2y: 0, x2: 100, y2: 0 }
    const bowed = { x1: 0, y1: 0, c1x: 33, c1y: 30, c2x: 66, c2y: 30, x2: 100, y2: 0 }
    expect(curveLengthMm(bowed)).toBeGreaterThan(curveLengthMm(straight))
  })
})

describe('findSnapTarget', () => {
  const shapes = [
    { id: 'a', x1: 0, y1: 0, x2: 100, y2: 0 },
    { id: 'b', x1: 100, y1: 100, x2: 200, y2: 100 },
  ]

  it('returns null when no endpoint is close enough', () => {
    expect(findSnapTarget(shapes, null, 999, 999)).toBeNull()
  })

  it('snaps to a nearby endpoint', () => {
    const target = findSnapTarget(shapes, null, 1, 1)
    expect(target).toEqual({ x: 0, y: 0 })
  })

  it('excludes the given shape id', () => {
    const shape = { id: 'a', x1: 0, y1: 0, x2: 100, y2: 0 }
    expect(findSnapTarget([shape], 'a', 1, 1)).toBeNull()
  })
})
