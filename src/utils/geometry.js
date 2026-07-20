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

export function findFilletCandidates(shapes, selectedIds) {
  const selected = shapes.filter(s => selectedIds.has(s.id))
  const endpoints = []
  for (const s of selected) {
    endpoints.push({ x: s.x1, y: s.y1, shapeId: s.id, which: 'x1' })
    endpoints.push({ x: s.x2, y: s.y2, shapeId: s.id, which: 'x2' })
  }
  const groups = []
  for (const ep of endpoints) {
    let found = false
    for (const g of groups) {
      if (dist(g.x, g.y, ep.x, ep.y) <= SNAP_MM) {
        g.members.push(ep)
        found = true
        break
      }
    }
    if (!found) {
      groups.push({ x: ep.x, y: ep.y, members: [ep] })
    }
  }
  return groups.filter(g => g.members.length >= 2)
}

export function computeFilletGeometry(ax, ay, bx, by, cx, cy, curvaturePercent) {
  const v1x = ax - bx, v1y = ay - by
  const v2x = cx - bx, v2y = cy - by
  const len1 = Math.hypot(v1x, v1y)
  const len2 = Math.hypot(v2x, v2y)
  if (len1 < 0.1 || len2 < 0.1) return null

  const u1x = v1x / len1, u1y = v1y / len1
  const u2x = v2x / len2, u2y = v2y / len2

  const cosTheta = Math.max(-1, Math.min(1, u1x * u2x + u1y * u2y))
  const theta = Math.acos(cosTheta)
  if (theta < 0.01 || theta > Math.PI - 0.01) return null

  const arcAngle = Math.PI - theta
  if (arcAngle < 0.01) return null

  const maxR = Math.min(len1, len2) * Math.tan(theta / 2)
  const r = (curvaturePercent / 100) * maxR
  if (r < 0.01) return null

  const d = r / Math.tan(theta / 2)
  const t1x = bx + u1x * d, t1y = by + u1y * d
  const t2x = bx + u2x * d, t2y = by + u2y * d

  let bisx = u1x + u2x, bisy = u1y + u2y
  const bisLen = Math.hypot(bisx, bisy)
  if (bisLen < 0.001) return null
  bisx /= bisLen
  bisy /= bisLen

  const distBO = r / Math.sin(theta / 2)
  const ox = bx + bisx * distBO, oy = by + bisy * distBO

  const a1 = Math.atan2(t1y - oy, t1x - ox)
  const a2 = Math.atan2(t2y - oy, t2x - ox)

  let ccw = (a2 - a1 + 2 * Math.PI) % (2 * Math.PI)
  let cw = (a1 - a2 + 2 * Math.PI) % (2 * Math.PI)
  const shortIsCCW = ccw <= cw
  const alpha = Math.min(ccw, cw)

  const h = (4 / 3) * Math.tan(alpha / 4) * r

  let tx1, ty1, tx2, ty2
  if (shortIsCCW) {
    const tl1 = Math.hypot(oy - t1y, t1x - ox)
    tx1 = (oy - t1y) / tl1
    ty1 = (t1x - ox) / tl1
    const tl2 = Math.hypot(oy - t2y, t2x - ox)
    tx2 = (oy - t2y) / tl2
    ty2 = (t2x - ox) / tl2
  } else {
    const tl1 = Math.hypot(t1y - oy, ox - t1x)
    tx1 = (t1y - oy) / tl1
    ty1 = (ox - t1x) / tl1
    const tl2 = Math.hypot(t2y - oy, ox - t2x)
    tx2 = (t2y - oy) / tl2
    ty2 = (ox - t2x) / tl2
  }

  return {
    t1x, t1y,
    t2x, t2y,
    c1x: t1x + h * tx1,
    c1y: t1y + h * ty1,
    c2x: t2x - h * tx2,
    c2y: t2y - h * ty2,
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
