import { SNAP_MM } from '../constants.js'

export function dist(x1, y1, x2, y2) {
  return Math.hypot(x2 - x1, y2 - y1)
}

export function makeDefaultCurve(x1, y1, x2, y2) {
  const len = dist(x1, y1, x2, y2)
  const dx = x2 - x1
  const dy = y2 - y1
  const px = len === 0 ? 0 : -dy / len
  const py = len === 0 ? 0 : dx / len
  const bow = Math.min(24, Math.max(8, len * 0.18))
  return {
    c1x: x1 + dx * 0.33 + px * bow,
    c1y: y1 + dy * 0.33 + py * bow,
    c2x: x1 + dx * 0.66 + px * bow,
    c2y: y1 + dy * 0.66 + py * bow,
  }
}

export function cubicPoint(t, p0, p1, p2, p3) {
  const mt = 1 - t
  return mt * mt * mt * p0 + 3 * mt * mt * t * p1 + 3 * mt * t * t * p2 + t * t * t * p3
}

export function curveLengthMm(s, steps = 40) {
  let total = 0
  let prevX = s.x1
  let prevY = s.y1
  for (let i = 1; i <= steps; i++) {
    const t = i / steps
    const x = cubicPoint(t, s.x1, s.c1x, s.c2x, s.x2)
    const y = cubicPoint(t, s.y1, s.c1y, s.c2y, s.y2)
    total += dist(prevX, prevY, x, y)
    prevX = x
    prevY = y
  }
  return total
}

export function findSnapTarget(shapes, excludeId, x, y) {
  let best = null
  let bestDist = SNAP_MM
  shapes.forEach((s) => {
    if (s.id === excludeId) return
    ;[
      [s.x1, s.y1],
      [s.x2, s.y2],
    ].forEach(([px, py]) => {
      const d = dist(x, y, px, py)
      if (d <= bestDist) {
        bestDist = d
        best = { x: px, y: py }
      }
    })
  })
  return best
}
