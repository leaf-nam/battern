import { SNAP_MM } from '../constants.js'
import { dist } from './geometry.js'

export function computeClosure(shapes) {
  if (!shapes.length) return { closed: false, openPoints: [] }
  const endpoints = []
  shapes.forEach((s) => {
    endpoints.push({ x: s.x1, y: s.y1 })
    endpoints.push({ x: s.x2, y: s.y2 })
  })
  const groups = []
  endpoints.forEach((ep) => {
    const g = groups.find((g) => dist(g.x, g.y, ep.x, ep.y) <= SNAP_MM)
    if (g) g.count += 1
    else groups.push({ x: ep.x, y: ep.y, count: 1 })
  })
  const openPoints = groups.filter((g) => g.count !== 2)
  return { closed: openPoints.length === 0, openPoints }
}
