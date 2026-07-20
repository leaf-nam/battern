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

export function findFilletPair(shapes, selectedIds) {
  const selected = shapes.filter(s => selectedIds.has(s.id))
  if (selected.length < 2) return null
  for (let i = 0; i < selected.length; i++) {
    for (let j = i + 1; j < selected.length; j++) {
      const a = selected[i], b = selected[j]
      const aEnds = [[a.x1, a.y1, 'x1'], [a.x2, a.y2, 'x2']]
      for (const [ax, ay, aWhich] of aEnds) {
        const bEnds = [[b.x1, b.y1, 'x1'], [b.x2, b.y2, 'x2']]
        for (const [bx, by, bWhich] of bEnds) {
          if (dist(ax, ay, bx, by) <= SNAP_MM) {
            const aOther = aWhich === 'x1' ? { x: a.x2, y: a.y2 } : { x: a.x1, y: a.y1 }
            const bOther = bWhich === 'x1' ? { x: b.x2, y: b.y2 } : { x: b.x1, y: b.y1 }
            return {
              shape1: a, endpoint1: aWhich, other1: aOther,
              shape2: b, endpoint2: bWhich, other2: bOther,
              sharedX: ax, sharedY: ay,
            }
          }
        }
      }
    }
  }
  return null
}

export function computeFilletCurve(ax, ay, bx, by, cx, cy, curvaturePercent) {
  const len1 = Math.hypot(ax - bx, ay - by)
  const len2 = Math.hypot(cx - bx, cy - by)
  if (len1 < 0.1 || len2 < 0.1) return null

  const ratio = Math.max(0, Math.min(1, curvaturePercent / 100))

  return {
    c1x: ax + (bx - ax) * ratio,
    c1y: ay + (by - ay) * ratio,
    c2x: cx + (bx - cx) * ratio,
    c2y: cy + (by - cy) * ratio,
  }
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
