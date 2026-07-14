import { dist, cubicPoint } from './geometry.js'

function buildOrderedPath(shapes, snapMm) {
  if (shapes.length < 2) return null
  const connAtEnd = new Map()
  for (let i = 0; i < shapes.length; i++) {
    for (let j = i + 1; j < shapes.length; j++) {
      const a = shapes[i], b = shapes[j]
      const aEnds = [[a.x1, a.y1, 0], [a.x2, a.y2, 1]]
      const bEnds = [[b.x1, b.y1, 0], [b.x2, b.y2, 1]]
      for (const [ax, ay, ae] of aEnds) {
        for (const [bx, by, be] of bEnds) {
          if (dist(ax, ay, bx, by) <= snapMm) {
            connAtEnd.set(`${a.id},${ae}`, { id: b.id, end: be })
            connAtEnd.set(`${b.id},${be}`, { id: a.id, end: ae })
          }
        }
      }
    }
  }
  const startId = shapes[0].id
  const ordered = [{ id: startId, entryEnd: 0 }]
  let curId = startId
  let curEntryEnd = 0
  const visited = new Set([startId])
  while (ordered.length <= shapes.length) {
    const exitEnd = curEntryEnd === 0 ? 1 : 0
    const conn = connAtEnd.get(`${curId},${exitEnd}`)
    if (!conn) break
    const { id: nextId, end: nextEntryEnd } = conn
    if (nextId === startId) break
    if (visited.has(nextId)) break
    visited.add(nextId)
    ordered.push({ id: nextId, entryEnd: nextEntryEnd })
    curId = nextId
    curEntryEnd = nextEntryEnd
  }
  if (ordered.length < 2) return null
  return ordered
}

function sampleSegment(shape, entryEnd, numSamples) {
  const pts = []
  if (shape.type === 'line') {
    if (entryEnd === 0) {
      pts.push({ x: shape.x1, y: shape.y1 }, { x: shape.x2, y: shape.y2 })
    } else {
      pts.push({ x: shape.x2, y: shape.y2 }, { x: shape.x1, y: shape.y1 })
    }
  } else {
    for (let i = 0; i <= numSamples; i++) {
      const t = i / numSamples
      const ct = entryEnd === 0 ? t : 1 - t
      pts.push({
        x: cubicPoint(ct, shape.x1, shape.c1x, shape.c2x, shape.x2),
        y: cubicPoint(ct, shape.y1, shape.c1y, shape.c2y, shape.y2),
      })
    }
  }
  return pts
}

function signedArea(pts) {
  let area = 0
  for (let i = 0; i < pts.length; i++) {
    const j = (i + 1) % pts.length
    area += pts[i].x * pts[j].y - pts[j].x * pts[i].y
  }
  return area / 2
}

function lineIntersect(a1, a2, b1, b2) {
  const dax = a2.x - a1.x, day = a2.y - a1.y
  const dbx = b2.x - b1.x, dby = b2.y - b1.y
  const denom = dax * dby - day * dbx
  if (Math.abs(denom) < 0.001) return null
  const t = ((b1.x - a1.x) * dby - (b1.y - a1.y) * dbx) / denom
  return { x: a1.x + t * dax, y: a1.y + t * day }
}

function offsetNormal(ax, ay, bx, by, dir) {
  const dx = bx - ax, dy = by - ay
  const len = Math.hypot(dx, dy)
  if (len < 0.001) return { nx: 0, ny: 0 }
  return { nx: (-dy / len) * dir, ny: (dx / len) * dir }
}

export function computeSeamPath(shapes, offsetMm) {
  const ordered = buildOrderedPath(shapes, 6)
  if (!ordered) return null
  const poly = []
  for (const { id, entryEnd } of ordered) {
    const s = shapes.find(sh => sh.id === id)
    if (!s) return null
    const pts = sampleSegment(s, entryEnd, 20)
    const startIdx = poly.length === 0 ? 0 : 1
    for (let i = startIdx; i < pts.length; i++) {
      poly.push(pts[i])
    }
  }
  if (poly.length < 3) return null
  const area = signedArea(poly)
  const dir = area > 0 ? 1 : -1
  const outPts = []
  const n = poly.length
  for (let i = 0; i < n; i++) {
    const prev = poly[(i - 1 + n) % n]
    const cur = poly[i]
    const next = poly[(i + 1) % n]
    const nIn = offsetNormal(prev.x, prev.y, cur.x, cur.y, dir)
    const nOut = offsetNormal(cur.x, cur.y, next.x, next.y, dir)
    const pIn = { x: cur.x + nIn.nx * offsetMm, y: cur.y + nIn.ny * offsetMm }
    const pOut = { x: cur.x + nOut.nx * offsetMm, y: cur.y + nOut.ny * offsetMm }
    const inStart = { x: prev.x + nIn.nx * offsetMm, y: prev.y + nIn.ny * offsetMm }
    const outEnd = { x: next.x + nOut.nx * offsetMm, y: next.y + nOut.ny * offsetMm }
    const miter = lineIntersect(inStart, pIn, pOut, outEnd)
    if (miter) {
      const miterLen = dist(cur.x, cur.y, miter.x, miter.y)
      if (miterLen <= offsetMm * 2.5) {
        outPts.push(miter)
        continue
      }
    }
    outPts.push(pIn)
    outPts.push(pOut)
  }
  let d = `M ${outPts[0].x.toFixed(3)},${outPts[0].y.toFixed(3)}`
  for (let i = 1; i < outPts.length; i++) {
    d += ` L ${outPts[i].x.toFixed(3)},${outPts[i].y.toFixed(3)}`
  }
  d += ' Z'
  return d
}
