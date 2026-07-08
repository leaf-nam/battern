import { describe, it, expect } from 'vitest'
import { computeClosure } from '../closure.js'

describe('computeClosure', () => {
  it('returns not closed for empty shapes', () => {
    const result = computeClosure([])
    expect(result.closed).toBe(false)
    expect(result.openPoints).toEqual([])
  })

  it('detects a single open line (two open endpoints)', () => {
    const shapes = [{ id: 'a', x1: 0, y1: 0, x2: 100, y2: 0 }]
    const result = computeClosure(shapes)
    expect(result.closed).toBe(false)
    expect(result.openPoints.length).toBe(2)
  })

  it('detects a closed loop of two line segments', () => {
    const shapes = [
      { id: 'a', x1: 0, y1: 0, x2: 100, y2: 0 },
      { id: 'b', x1: 100, y1: 0, x2: 0, y2: 0 },
    ]
    const result = computeClosure(shapes)
    expect(result.closed).toBe(true)
    expect(result.openPoints).toEqual([])
  })

  it('detects open points in an incomplete loop', () => {
    const shapes = [
      { id: 'a', x1: 0, y1: 0, x2: 100, y2: 0 },
      { id: 'b', x1: 100, y1: 0, x2: 100, y2: 100 },
    ]
    const result = computeClosure(shapes)
    expect(result.closed).toBe(false)
    expect(result.openPoints.length).toBe(2)
  })
})
