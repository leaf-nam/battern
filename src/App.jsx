import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import { SHEET_PRESETS, ZOOM_STEPS, DEFAULT_ZOOM, GRID_MM, GRID_BOLD_EVERY, MIN_DRAG_MM, STORAGE_KEY, INK, STROKE_MM, SNAP_MM, MIN_SHEET_MM, MAX_SHEET_MM, DEFAULT_SEAM_MM } from './constants.js'
import { dist, makeDefaultCurve, findSnapTarget, findFilletPair, computeFilletArc, arcCenter, arcMidpoint, circumcircle } from './utils/geometry.js'
import { computeClosure } from './utils/closure.js'
import { buildSvgString, buildTiledPrintHtml, downloadBlob } from './utils/svg.js'
import { computeSeamPath } from './utils/seam.js'
import { uid } from './utils/uid.js'
import { BrandMark, ICONS } from './icons.jsx'
import Handle from './components/Handle.jsx'
import PropertiesPanel from './components/PropertiesPanel.jsx'
import LibraryPanel from './components/LibraryPanel.jsx'
import SaveModal from './components/SaveModal.jsx'

export default function App() {
  const [sheetKey, setSheetKey] = useState('block')
  const [customW, setCustomW] = useState(800)
  const [customH, setCustomH] = useState(1000)
  const sheet = sheetKey === 'custom'
    ? { label: `사용자 설정 (${customW}×${customH}mm)`, w: customW, h: customH }
    : SHEET_PRESETS[sheetKey]

  const [shapes, setShapes] = useState([])
  const [selectedId, setSelectedId] = useState(null)
  const [selectedIds, setSelectedIds] = useState([])
  const [tool, setTool] = useState('line')
  const [zoom, setZoom] = useState(DEFAULT_ZOOM)
  const [panelTab, setPanelTab] = useState('properties')
  const [cursorMm, setCursorMm] = useState(null)

  const [draft, setDraft] = useState(null)
  const dragStartRef = useRef(null)
  const [dragging, setDragging] = useState(null)
  const arcDragRef = useRef(null)
  const [arcHandlePos, setArcHandlePos] = useState(null)
  const [snapTarget, setSnapTarget] = useState(null)

  const [marquee, setMarquee] = useState(null)
  const moveRef = useRef(null)  // { prevX, prevY, ids } when moving, null when idle
  const resizeRef = useRef(null)  // { handle, box, startX, startY, ids, snapshot } when resizing, null when idle

  const [savedPatterns, setSavedPatterns] = useState([])
  const [showSaveModal, setShowSaveModal] = useState(false)
  const [saveName, setSaveName] = useState('')

  const [backgroundImage, setBackgroundImage] = useState(null)
  const [seamEnabled, setSeamEnabled] = useState(false)
  const [seamWidth, setSeamWidth] = useState(DEFAULT_SEAM_MM)
  const [filletCurvature, setFilletCurvature] = useState(50)
  const [includeBgExport, setIncludeBgExport] = useState(true)
  const [transparentBgExport, setTransparentBgExport] = useState(false)
  const fileInputRef = useRef(null)

  const [mobilePanelOpen, setMobilePanelOpen] = useState(false)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [statusTooltip, setStatusTooltip] = useState(null)
  const menuBtnRef = useRef(null)
  const dropRef = useRef(null)

  useEffect(() => {
    function onPointerDown(e) {
      if (!mobileMenuOpen) return
      if (dropRef.current && !dropRef.current.contains(e.target) && menuBtnRef.current && !menuBtnRef.current.contains(e.target)) {
        setMobileMenuOpen(false)
      }
    }
    document.addEventListener('pointerdown', onPointerDown)
    return () => document.removeEventListener('pointerdown', onPointerDown)
  }, [mobileMenuOpen])

  useEffect(() => {
    if (!statusTooltip) return
    function onPointerDown() { setStatusTooltip(null) }
    document.addEventListener('pointerdown', onPointerDown)
    return () => document.removeEventListener('pointerdown', onPointerDown)
  }, [statusTooltip])

  const svgRef = useRef(null)
  const historyRef = useRef([])
  const panRef = useRef({ active: false })

  function handleBackgroundUpload() {
    fileInputRef.current?.click()
  }

  function handleFileChange(e) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => setBackgroundImage(ev.target.result)
    reader.readAsDataURL(file)
    e.target.value = ''
  }

  function removeBackground() {
    setBackgroundImage(null)
  }

  function saveForUndo() {
    historyRef.current.push(shapes)
    if (historyRef.current.length > 50) historyRef.current.shift()
  }

  function undo() {
    if (historyRef.current.length === 0) return
    setShapes(historyRef.current.pop())
  }

  /* ---------------- persistence ---------------- */

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      if (raw) setSavedPatterns(JSON.parse(raw))
    } catch {
      /* ignore corrupt storage */
    }
  }, [])

  function persist(list) {
    setSavedPatterns(list)
    localStorage.setItem(STORAGE_KEY, JSON.stringify(list))
  }

  /* ---------------- coordinate helpers ---------------- */

  function touchEvent(e) {
    const t = e.touches?.[0] ?? e.changedTouches?.[0]
    return t ? { clientX: t.clientX, clientY: t.clientY } : { clientX: 0, clientY: 0 }
  }

  function handleShapeDown(e, s, selSet) {
    if (tool !== 'select') return
    const isTouch = !!e.touches
    const pt = isTouch ? touchEvent(e) : e
    if (isTouch) e.preventDefault()
    e.stopPropagation()

    if (selectedIds.length > 0) {
      if (selSet.has(s.id)) {
        const { x, y } = clientToMm(pt.clientX, pt.clientY)
        saveForUndo()
        moveRef.current = { prevX: x, prevY: y, ids: new Set(selSet) }
      } else {
        setSelectedIds((prev) => [...prev, s.id])
      }
      return
    }
    if (s.id === selectedId) {
      const { x, y } = clientToMm(pt.clientX, pt.clientY)
      saveForUndo()
      moveRef.current = { prevX: x, prevY: y, ids: new Set([s.id]) }
    } else {
      setSelectedId(s.id)
      setSelectedIds([])
      setPanelTab('properties')
    }
  }

  const clientToMm = useCallback(
    (clientX, clientY) => {
      const rect = svgRef.current.getBoundingClientRect()
      const x = (clientX - rect.left) / zoom
      const y = (clientY - rect.top) / zoom
      return {
        x: Math.min(Math.max(x, 0), sheet.w),
        y: Math.min(Math.max(y, 0), sheet.h),
      }
    },
    [zoom, sheet.w, sheet.h],
  )

  /* ---------------- drawing / marquee / handle drag ---------------- */

  function handleSheetMouseDown(e) {
    let { x, y } = clientToMm(e.clientX, e.clientY)

    if (tool === 'select') {
      setMarquee({ x1: x, y1: y, x2: x, y2: y })
      return
    }

    const snap = findSnapTarget(shapes, null, x, y)
    if (snap) ({ x, y } = snap)
    dragStartRef.current = { x, y }
    setDraft({ type: tool, x1: x, y1: y, x2: x, y2: y })
    setSnapTarget(snap)
  }

  function handleSheetMouseMove(e) {
    let { x, y } = clientToMm(e.clientX, e.clientY)
    setCursorMm({ x, y })

    if (marquee) {
      setMarquee((m) => ({ ...m, x2: x, y2: y }))
      return
    }

    if (resizeRef.current) {
      const { handle, box, ids, snapshot } = resizeRef.current
      let nbx = box.x, nby = box.y, nbw = box.w, nbh = box.h
      switch (handle) {
        case 'se': nbw = x - box.x; nbh = y - box.y; break
        case 'nw': nbx = x; nby = y; nbw = box.x + box.w - x; nbh = box.y + box.h - y; break
        case 'ne': nby = y; nbw = x - box.x; nbh = box.y + box.h - y; break
        case 'sw': nbx = x; nbw = box.x + box.w - x; nbh = y - box.y; break
        case 'n': nby = y; nbh = box.y + box.h - y; break
        case 's': nbh = y - box.y; break
        case 'e': nbw = x - box.x; break
        case 'w': nbx = x; nbw = box.x + box.w - x; break
      }
      if (nbw < 3) nbw = 3
      if (nbh < 3) nbh = 3
      if (box.w > 0 && box.h > 0) {
        const idSet = new Set(ids)
        const scale = (p, off, size, newOff, newSize) => newOff + ((p - off) / size) * newSize
        setShapes(snapshot.map((s) => {
          if (!idSet.has(s.id)) return s
          const r = {
            ...s,
            x1: scale(s.x1, box.x, box.w, nbx, nbw),
            y1: scale(s.y1, box.y, box.h, nby, nbh),
            x2: scale(s.x2, box.x, box.w, nbx, nbw),
            y2: scale(s.y2, box.y, box.h, nby, nbh),
          }
          if (s.type === 'curve') {
            r.c1x = scale(s.c1x, box.x, box.w, nbx, nbw)
            r.c1y = scale(s.c1y, box.y, box.h, nby, nbh)
            r.c2x = scale(s.c2x, box.x, box.w, nbx, nbw)
            r.c2y = scale(s.c2y, box.y, box.h, nby, nbh)
          }
          return r
        }))
      }
      return
    }

    if (moveRef.current) {
      let dx = x - moveRef.current.prevX
      let dy = y - moveRef.current.prevY
      const ids = moveRef.current.ids
      const idSet = new Set(ids)

      let snapDx = 0, snapDy = 0
      let bestDist = SNAP_MM
      let snapTargetPt = null
      for (const s of shapes) {
        if (!idSet.has(s.id)) continue
        const endpts = [[s.x1, s.y1], [s.x2, s.y2]]
        for (const [ex, ey] of endpts) {
          const cx = ex + dx
          const cy = ey + dy
          for (const other of shapes) {
            if (idSet.has(other.id)) continue
            const oEndpts = [[other.x1, other.y1], [other.x2, other.y2]]
            for (const [ox, oy] of oEndpts) {
              const d = dist(cx, cy, ox, oy)
              if (d <= bestDist) {
                bestDist = d
                snapDx = ox - cx
                snapDy = oy - cy
                snapTargetPt = { x: ox, y: oy }
              }
            }
          }
        }
      }
      dx += snapDx
      dy += snapDy
      setSnapTarget(snapTargetPt)

      setShapes((prev) =>
        prev.map((s) => {
          if (!idSet.has(s.id)) return s
          return {
            ...s,
            x1: s.x1 + dx,
            y1: s.y1 + dy,
            x2: s.x2 + dx,
            y2: s.y2 + dy,
            ...(s.type === 'curve'
              ? { c1x: s.c1x + dx, c1y: s.c1y + dy, c2x: s.c2x + dx, c2y: s.c2y + dy }
              : {}),
          }
        }),
      )
      moveRef.current = { ...moveRef.current, prevX: x, prevY: y }
      return
    }

    if (draft && dragStartRef.current) {
      let targetX = x, targetY = y
      if (e.shiftKey) {
        const dx = x - dragStartRef.current.x
        const dy = y - dragStartRef.current.y
        const len = Math.hypot(dx, dy)
        if (len > 0) {
          const angle = Math.atan2(dy, dx)
          const snapped = Math.round(angle / (Math.PI / 4)) * (Math.PI / 4)
          targetX = dragStartRef.current.x + len * Math.cos(snapped)
          targetY = dragStartRef.current.y + len * Math.sin(snapped)
        }
      }
      const snap = findSnapTarget(shapes, null, targetX, targetY)
      if (snap) ({ x: targetX, y: targetY } = snap)
      setSnapTarget(snap)
      setDraft((d) => ({ ...d, x2: targetX, y2: targetY }))
      return
    }
    if (dragging && selectedId) {
      if (dragging.handle === 'p1' || dragging.handle === 'p2') {
        const snap = findSnapTarget(shapes, selectedId, x, y)
        if (snap) ({ x, y } = snap)
        setSnapTarget(snap)
      } else if (dragging.handle === 'r' && arcDragRef.current) {
        const ds = arcDragRef.current
        let shape = shapes.find(s => s.id === selectedId)
        if (shape && shape.type === 'arc') {
          const chord = dist(shape.x1, shape.y1, shape.x2, shape.y2)
          const mx = (shape.x1 + shape.x2) / 2, my = (shape.y1 + shape.y2) / 2
          const cc = arcCenter(shape.x1, shape.y1, shape.x2, shape.y2, shape.r, shape.sweep)
          if (cc) {
            const pd = dist(cc.cx, cc.cy, mx, my)
            if (pd > 0.001) {
              const bux = -(cc.cx - mx) / pd, buy = -(cc.cy - my) / pd
              const dx = x - ds.mouseX, dy = y - ds.mouseY
              const delta = dx * bux + dy * buy
              const minR = chord * 0.5 + 0.5
              const newR = Math.max(minR, ds.startR + delta)
              setShapes(prev => prev.map(s => s.id === selectedId ? { ...s, r: newR } : s))
              const projSag = ((x - mx) * bux + (y - my) * buy)
              setArcHandlePos({ x: mx + bux * projSag, y: my + buy * projSag })
            }
          }
        }
      } else {
        setSnapTarget(null)
      }
      if (dragging.handle !== 'r') {
        updateHandle(selectedId, dragging.handle, x, y)
      }
    }
  }

  function handleSheetMouseUp() {
    if (marquee) {
      const { x1, y1, x2, y2 } = marquee
      const w = Math.abs(x2 - x1)
      const h = Math.abs(y2 - y1)
      if (w < MIN_DRAG_MM && h < MIN_DRAG_MM) {
        setSelectedIds([])
        setSelectedId(null)
      } else {
        const left = Math.min(x1, x2)
        const right = Math.max(x1, x2)
        const top = Math.min(y1, y2)
        const bottom = Math.max(y1, y2)
        const ids = shapes
          .filter((s) => {
            const xs = [s.x1, s.x2]
            const ys = [s.y1, s.y2]
            if (s.type === 'curve') {
              xs.push(s.c1x, s.c2x)
              ys.push(s.c1y, s.c2y)
            }
            const sL = Math.min(...xs)
            const sR = Math.max(...xs)
            const sT = Math.min(...ys)
            const sB = Math.max(...ys)
            return sL < right && sR > left && sT < bottom && sB > top
          })
          .map((s) => s.id)
        if (ids.length === 1) {
          setSelectedIds([])
          setSelectedId(ids[0])
        } else {
          setSelectedIds(ids)
          setSelectedId(null)
        }
      }
      setMarquee(null)
      return
    }

    if (resizeRef.current) {
      resizeRef.current = null
      return
    }

    if (moveRef.current) {
      moveRef.current = null
      setSnapTarget(null)
      return
    }

    if (draft && dragStartRef.current) {
      const { x1, y1, x2, y2 } = draft
      const len = dist(x1, y1, x2, y2)
      if (len >= MIN_DRAG_MM) {
        const id = uid()
        let newShape
        if (draft.type === 'curve') {
          newShape = { id, type: 'curve', x1, y1, x2, y2, ...makeDefaultCurve(x1, y1, x2, y2) }
        } else {
          newShape = { id, type: 'line', x1, y1, x2, y2 }
        }
        saveForUndo()
        setShapes((prev) => [...prev, newShape])
        setSelectedId(id)
        setPanelTab('properties')
      }
      setDraft(null)
      dragStartRef.current = null
    }
    if (dragging) {
      if (dragging.handle === 'r') { arcDragRef.current = null; setArcHandlePos(null) }
      setDragging(null)
    }
    setSnapTarget(null)
  }

  /* ---------------- editing existing shapes ---------------- */

  function updateHandle(id, handle, x, y) {
    setShapes((prev) =>
      prev.map((s) => {
        if (s.id !== id) return s
        if (handle === 'p1') return { ...s, x1: x, y1: y }
        if (handle === 'p2') return { ...s, x2: x, y2: y }
        if (handle === 'c1') return { ...s, c1x: x, c1y: y }
        if (handle === 'c2') return { ...s, c2x: x, c2y: y }
        if (handle === 'r') {
          const cc = circumcircle(s.x1, s.y1, s.x2, s.y2, x, y)
          if (!cc) return s
          const chord = dist(s.x1, s.y1, s.x2, s.y2)
          const minR = chord * 0.5 + 0.1
          const maxR = chord * 50
          const newR = Math.max(minR, Math.min(maxR, cc.r))
          return { ...s, r: newR }
        }
        return s
      }),
    )
  }

  function setLineLengthCm(id, newLenCm) {
    saveForUndo()
    setShapes((prev) =>
      prev.map((s) => {
        if (s.id !== id || s.type !== 'line') return s
        const newLenMm = Math.max(0.1, newLenCm) * 10
        const curLen = dist(s.x1, s.y1, s.x2, s.y2)
        const angle = curLen === 0 ? 0 : Math.atan2(s.y2 - s.y1, s.x2 - s.x1)
        return {
          ...s,
          x2: s.x1 + Math.cos(angle) * newLenMm,
          y2: s.y1 + Math.sin(angle) * newLenMm,
        }
      }),
    )
  }

  function deleteShape(id) {
    saveForUndo()
    if (selectedIds.length > 1 && selectedIds.includes(id)) {
      const idsToRemove = new Set(selectedIds)
      setShapes((prev) => prev.filter((s) => !idsToRemove.has(s.id)))
      setSelectedId(null)
      setSelectedIds([])
    } else {
      setShapes((prev) => prev.filter((s) => s.id !== id))
      if (selectedId === id) setSelectedId(null)
      setSelectedIds([])
    }
  }

  function deleteSelectedShapes() {
    if (selectedIds.length > 0) {
      saveForUndo()
      const idsToRemove = new Set(selectedIds)
      setShapes((prev) => prev.filter((s) => !idsToRemove.has(s.id)))
      setSelectedId(null)
      setSelectedIds([])
    } else if (selectedId) {
      deleteShape(selectedId)
    }
  }

  useEffect(() => {
    if (tool !== 'select') {
      setSelectedId(null)
      setSelectedIds([])
    }
  }, [tool])

  useEffect(() => {
    function onKeyDown(e) {
      const tag = document.activeElement?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA') return
      if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
        e.preventDefault()
        undo()
        return
      }
      if ((e.key === 'Delete' || e.key === 'Backspace') && (selectedId || selectedIds.length > 0)) {
        e.preventDefault()
        deleteSelectedShapes()
        return
      }
      if (e.code === 'KeyV') { setTool('select'); return }
      if (e.code === 'KeyL') { setTool('line'); return }
      if (e.code === 'KeyC') { setTool('curve'); return }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [selectedId, selectedIds])

  function computeBounds(ids) {
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
    for (const s of shapes) {
      if (!ids.has(s.id)) continue
      const pts = [s.x1, s.y1, s.x2, s.y2]
      if (s.type === 'curve') pts.push(s.c1x, s.c1y, s.c2x, s.c2y)
      for (let i = 0; i < pts.length; i += 2) {
        if (pts[i] < minX) minX = pts[i]
        if (pts[i] > maxX) maxX = pts[i]
        if (pts[i + 1] < minY) minY = pts[i + 1]
        if (pts[i + 1] > maxY) maxY = pts[i + 1]
      }
    }
    return { x: minX, y: minY, w: maxX - minX, h: maxY - minY }
  }

  function handleResizeStart(clientX, clientY, handle) {
    const { x, y } = clientToMm(clientX, clientY)
    const ids = selectedIds.length > 0 ? new Set(selectedIds) : new Set([selectedId])
    if (ids.size === 0) return
    const box = computeBounds(ids)
    saveForUndo()
    resizeRef.current = { handle, startX: x, startY: y, box, ids: [...ids], snapshot: shapes.slice() }
  }

  function scaleShapes(ids, box, nbx, nby, nbw, nbh) {
    if (box.w === 0 || box.h === 0) return
    const idSet = new Set(ids)
    setShapes((prev) =>
      prev.map((s) => {
        if (!idSet.has(s.id)) return s
        const scale = (p, off, size, newOff, newSize) => newOff + ((p - off) / size) * newSize
        const r = {
          ...s,
          x1: scale(s.x1, box.x, box.w, nbx, nbw),
          y1: scale(s.y1, box.y, box.h, nby, nbh),
          x2: scale(s.x2, box.x, box.w, nbx, nbw),
          y2: scale(s.y2, box.y, box.h, nby, nbh),
        }
        if (s.type === 'curve') {
          r.c1x = scale(s.c1x, box.x, box.w, nbx, nbw)
          r.c1y = scale(s.c1y, box.y, box.h, nby, nbh)
          r.c2x = scale(s.c2x, box.x, box.w, nbx, nbw)
          r.c2y = scale(s.c2y, box.y, box.h, nby, nbh)
        }
        if (s.type === 'arc') {
          r.r = s.r * Math.min(nbw / box.w, nbh / box.h)
        }
        return r
      }),
    )
  }

  /* ---------------- fillet ---------------- */

  function applyFillet() {
    const pair = findFilletPair(shapes, new Set(selectedIds))
    if (!pair) return

    saveForUndo()

    const { shape1, endpoint1, other1, shape2, endpoint2, other2, sharedX, sharedY } = pair
    const ax = other1.x, ay = other1.y
    const cx = other2.x, cy = other2.y
    const bx = sharedX, by = sharedY

    const fa = computeFilletArc(ax, ay, bx, by, cx, cy, filletCurvature)
    if (!fa) return

    const arcId = uid()

    setShapes(prev => [
      ...prev.map(s => {
        if (s.id === shape1.id) {
          if (endpoint1 === 'x1') return { ...s, x1: fa.t1x, y1: fa.t1y }
          else return { ...s, x2: fa.t1x, y2: fa.t1y }
        }
        if (s.id === shape2.id) {
          if (endpoint2 === 'x1') return { ...s, x1: fa.t2x, y1: fa.t2y }
          else return { ...s, x2: fa.t2x, y2: fa.t2y }
        }
        return s
      }),
      {
        id: arcId, type: 'arc',
        x1: fa.t1x, y1: fa.t1y,
        x2: fa.t2x, y2: fa.t2y,
        r: fa.radius, sweep: fa.sweep,
      },
    ])
    setSelectedIds([])
    setSelectedId(arcId)
  }

  function setArcRadius(id, newR) {
    saveForUndo()
    setShapes((prev) =>
      prev.map((s) => {
        if (s.id !== id || s.type !== 'arc') return s
        const chord = dist(s.x1, s.y1, s.x2, s.y2)
        const minR = chord * 0.5 + 0.5
        const maxR = chord * 50
        return { ...s, r: Math.max(minR, Math.min(maxR, newR)) }
      }),
    )
  }

  /* ---------------- zoom ---------------- */

  function zoomToFit() {
    if (shapes.length === 0) {
      setZoom(DEFAULT_ZOOM)
      return
    }
    let minX = sheet.w, minY = sheet.h, maxX = 0, maxY = 0
    shapes.forEach((s) => {
      const xs = [s.x1, s.x2]
      const ys = [s.y1, s.y2]
      if (s.type === 'curve') {
        xs.push(s.c1x, s.c2x)
        ys.push(s.c1y, s.c2y)
      }
      for (const v of xs) { if (v < minX) minX = v; if (v > maxX) maxX = v }
      for (const v of ys) { if (v < minY) minY = v; if (v > maxY) maxY = v }
    })
    const contentW = maxX - minX + 20
    const contentH = maxY - minY + 20
    const fitW = sheet.w / contentW
    const fitH = sheet.h / contentH
    const fit = Math.min(fitW, fitH)
    const nearest = ZOOM_STEPS.reduce((prev, curr) =>
      Math.abs(curr - fit) < Math.abs(prev - fit) ? curr : prev
    )
    setZoom(Math.max(1, nearest))
  }

  function zoomReset() {
    setZoom(DEFAULT_ZOOM)
  }

  /* ---------------- computed ---------------- */

  const selectedShape = useMemo(() => shapes.find((s) => s.id === selectedId) || null, [shapes, selectedId])
  const closureStatus = useMemo(() => computeClosure(shapes), [shapes])
  const canSave = shapes.length > 0 && closureStatus.closed
  const canApplyFillet = useMemo(() => {
    if (selectedIds.length < 2) return false
    return findFilletPair(shapes, new Set(selectedIds)) !== null
  }, [shapes, selectedIds])
  const seamPath = useMemo(() => {
    if (!seamEnabled || !closureStatus.closed || seamWidth <= 0) return null
    return computeSeamPath(shapes, seamWidth)
  }, [shapes, seamEnabled, seamWidth, closureStatus.closed])

  /* ---------------- file actions ---------------- */

  function handleNewPattern() {
    if (shapes.length && !window.confirm('현재 캔버스를 비웁니다. 저장하지 않은 작업은 사라집니다. 계속할까요?')) return
    saveForUndo()
    setShapes([])
    setBackgroundImage(null)
    setSelectedId(null)
    setSelectedIds([])
  }

  function handleExportSvg() {
    if (!canSave) return
    const bg = includeBgExport ? backgroundImage : null
    const svg = buildSvgString(shapes, sheet.w, sheet.h, bg, false, seamPath)
    downloadBlob(`furboaee-pattern-${Date.now()}.svg`, new Blob([svg], { type: 'image/svg+xml' }))
  }

  function handleExportPng() {
    const bg = includeBgExport ? backgroundImage : null
    const svg = buildSvgString(shapes, sheet.w, sheet.h, bg, transparentBgExport, seamPath)
    const blob = new Blob([svg], { type: 'image/svg+xml' })
    const url = URL.createObjectURL(blob)
    const img = new Image()
    img.onload = () => {
      const PX_PER_MM = 150 / 25.4
      const canvas = document.createElement('canvas')
      canvas.width = Math.round(sheet.w * PX_PER_MM)
      canvas.height = Math.round(sheet.h * PX_PER_MM)
      const ctx = canvas.getContext('2d')
      if (!transparentBgExport) {
        ctx.fillStyle = '#ffffff'
        ctx.fillRect(0, 0, canvas.width, canvas.height)
      }
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
      URL.revokeObjectURL(url)
      canvas.toBlob((pngBlob) => downloadBlob(`furboaee-pattern-${Date.now()}.png`, pngBlob), 'image/png')
    }
    img.src = url
  }

  function handleCustomSheetChange(wMm, hMm) {
    const w = Math.round(Math.min(Math.max(wMm, MIN_SHEET_MM), MAX_SHEET_MM))
    const h = Math.round(Math.min(Math.max(hMm, MIN_SHEET_MM), MAX_SHEET_MM))
    setCustomW(w)
    setCustomH(h)
  }

  function handlePrint() {
    window.print()
  }

  function handleTiledPrint() {
    const bg = includeBgExport ? backgroundImage : null
    const html = buildTiledPrintHtml(shapes, sheet.w, sheet.h, bg, seamPath)
    const win = window.open('', '_blank')
    if (!win) {
      alert('팝업이 차단되었습니다. 팝업 차단을 해제해 주세요.')
      return
    }
    win.document.write(html)
    win.document.close()
    win.focus()
    setTimeout(() => win.print(), 500)
  }

  function openSaveModal() {
    if (!canSave) return
    setSaveName(`패턴 ${new Date().toLocaleDateString('ko-KR')}`)
    setShowSaveModal(true)
  }

  function confirmSave() {
    if (!canSave) return
    const name = saveName.trim() || '이름 없는 패턴'
    const exportBg = includeBgExport ? backgroundImage : null
    const entry = {
      id: uid(),
      name,
      createdAt: Date.now(),
      sheetKey,
      ...(sheetKey === 'custom' ? { customW, customH } : {}),
      shapes,
      backgroundImage,
      svg: buildSvgString(shapes, sheet.w, sheet.h, exportBg, false, seamPath),
    }
    persist([entry, ...savedPatterns])
    setShowSaveModal(false)
  }

  function loadPattern(entry) {
    if (shapes.length && !window.confirm('현재 캔버스의 작업을 덮어씁니다. 계속할까요?')) return
    saveForUndo()
    if (entry.sheetKey === 'custom' && entry.customW && entry.customH) {
      setSheetKey('custom')
      setCustomW(entry.customW)
      setCustomH(entry.customH)
    } else if (entry.sheetKey && SHEET_PRESETS[entry.sheetKey]) {
      setSheetKey(entry.sheetKey)
    } else {
      setSheetKey('block')
    }
    setShapes(entry.shapes.map((s) => ({ ...s })))
    setBackgroundImage(entry.backgroundImage ?? null)
    setIncludeBgExport(true)
    setSelectedId(null)
    setSelectedIds([])
    setPanelTab('properties')
  }

  function deleteSavedPattern(id) {
    if (!window.confirm('보관함에서 이 패턴을 삭제할까요?')) return
    persist(savedPatterns.filter((p) => p.id !== id))
  }

  /* ---------------- grid ---------------- */

  const gridLines = useMemo(() => {
    const lines = []
    for (let x = 0; x <= sheet.w; x += GRID_MM) {
      const bold = Math.round(x / GRID_MM) % GRID_BOLD_EVERY === 0
      lines.push(
        <line key={`v${x}`} x1={x} y1={0} x2={x} y2={sheet.h} stroke="var(--paper-line-strong)" strokeOpacity={bold ? 0.9 : 0} strokeWidth={bold ? 0.4 : 0} />,
      )
    }
    for (let y = 0; y <= sheet.h; y += GRID_MM) {
      const bold = Math.round(y / GRID_MM) % GRID_BOLD_EVERY === 0
      lines.push(
        <line key={`h${y}`} x1={0} y1={y} x2={sheet.w} y2={y} stroke="var(--paper-line-strong)" strokeOpacity={bold ? 0.9 : 0} strokeWidth={bold ? 0.4 : 0} />,
      )
    }
    return lines
  }, [sheet.w, sheet.h])

  const cornerTicks = [
    [10, 10],
    [sheet.w - 10, 10],
    [10, sheet.h - 10],
    [sheet.w - 10, sheet.h - 10],
  ]

  const cx = sheet.w / 2
  const cy = sheet.h / 2

  /* ---------------- render ---------------- */

  const selSet = new Set(selectedIds)
  const statusText = selectedIds.length > 1
    ? `${selectedIds.length}개 선택됨`
    : closureStatus.closed
      ? '폐곡선 완성 ✓'
      : shapes.length
        ? `열린 점 ${closureStatus.openPoints.length}개 — 이어서 그려야 저장 가능`
        : '폐곡선을 그리면 저장할 수 있습니다'
  const selectionBounds = useMemo(() => {
    const idList = selectedIds.length > 0 ? selectedIds : (selectedId ? [selectedId] : [])
    if (idList.length === 0) return null
    return computeBounds(new Set(idList))
  }, [shapes, selectedIds, selectedId])

  return (
    <div className="app">
      <header className="app-header" style={{ position: 'relative' }}>
        <div className="brand">
          <BrandMark onClick={() => setMobilePanelOpen(false)} style={{ cursor: 'pointer' }} />
          <div className="brand-text">
            <h1>Furboaee Draft</h1>
            <p>PATTERN STUDIO · SINCE 1985</p>
          </div>
        </div>
        <div className="header-divider" />
        <span className="header-sub">
          {sheet.label} · {shapes.length}개 요소
        </span>
        <div className="header-spacer" />
        <div className="header-actions">
          <button className="btn" onClick={handleNewPattern}>
            새 패턴
          </button>
          <button
            className="btn"
            onClick={handleExportSvg}
            disabled={!canSave}
            title={!canSave ? '모든 선/곡선의 끝점이 폐곡선을 이루어야 저장할 수 있습니다' : ''}
          >
            SVG 저장
          </button>
          <button className="btn" onClick={handleExportPng} disabled={!shapes.length}>
            PNG 내보내기
          </button>
          <button className="btn" onClick={handlePrint} disabled={!shapes.length}>
            인쇄 (1:1)
          </button>
          <button className="btn" onClick={handleTiledPrint} disabled={!shapes.length || (sheet.w <= 210 && sheet.h <= 297)}>
            분할 인쇄
          </button>
          <button
            className="btn btn-gold"
            onClick={openSaveModal}
            disabled={!canSave}
            title={!canSave ? '모든 선/곡선의 끝점이 폐곡선을 이루어야 저장할 수 있습니다' : ''}
          >
            보관함에 저장
          </button>
        </div>
        <button ref={menuBtnRef} className="mobile-menu-btn" onClick={() => setMobileMenuOpen((v) => !v)}>
          ≡
        </button>
        {mobileMenuOpen && (
          <div ref={dropRef} className="mobile-menu-dropdown">
            <button className="btn" onClick={() => { handleNewPattern(); setMobileMenuOpen(false) }}>
              새 패턴
            </button>
            <button className="btn" onClick={() => { handleExportSvg(); setMobileMenuOpen(false) }} disabled={!canSave}>
              SVG 저장
            </button>
            <button className="btn" onClick={() => { handleExportPng(); setMobileMenuOpen(false) }} disabled={!shapes.length}>
              PNG 내보내기
            </button>
            <button className="btn" onClick={() => { handlePrint(); setMobileMenuOpen(false) }} disabled={!shapes.length}>
              인쇄 (1:1)
            </button>
            <button className="btn" onClick={() => { handleTiledPrint(); setMobileMenuOpen(false) }} disabled={!shapes.length || (sheet.w <= 210 && sheet.h <= 297)}>
              분할 인쇄
            </button>
            <button className="btn" style={{ color: 'var(--gold)' }} onClick={() => { openSaveModal(); setMobileMenuOpen(false) }} disabled={!canSave}>
              보관함에 저장
            </button>
          </div>
        )}
        <input
          type="file"
          accept="image/*"
          ref={fileInputRef}
          style={{ display: 'none' }}
          onChange={handleFileChange}
        />
      </header>

      <div className="app-body">
        <nav className="toolbar">
          <button
            className={`tool-btn ${tool === 'select' ? 'active' : ''}`}
            onClick={() => setTool('select')}
            title="선택 / 편집 (V)"
          >
            {ICONS.select}
            선택 <span className="tool-key">V</span>
          </button>
          <button className={`tool-btn ${tool === 'line' ? 'active' : ''}`} onClick={() => setTool('line')} title="직선 그리기 (L)">
            {ICONS.line}
            직선 <span className="tool-key">L</span>
          </button>
          <button className={`tool-btn ${tool === 'curve' ? 'active' : ''}`} onClick={() => setTool('curve')} title="곡선 그리기 (C)">
            {ICONS.curve}
            곡선 <span className="tool-key">C</span>
          </button>

          <div className="toolbar-divider" />

          <button
            className="tool-btn"
            onClick={deleteSelectedShapes}
            disabled={!selectedId && selectedIds.length === 0}
            title="선택한 요소 삭제 (Delete)"
          >
            {ICONS.trash}
            삭제 <span className="tool-key">Del</span>
          </button>

          <div className="toolbar-divider" />

          <button
            className={`tool-btn ${seamEnabled && closureStatus.closed ? 'active' : ''}`}
            onClick={() => setSeamEnabled((v) => !v)}
            disabled={!closureStatus.closed}
            title={closureStatus.closed ? '시접 자동 생성' : '폐곡선을 완성해야 시접을 생성할 수 있습니다'}
          >
            {ICONS.seam}
            시접
          </button>

          <button
            className="tool-btn"
            onClick={applyFillet}
            disabled={!canApplyFillet}
            title={canApplyFillet ? '꼭지점을 곡선으로 부드럽게 처리' : '끝점을 공유하는 2개 이상의 요소를 선택해야 필렛을 적용할 수 있습니다'}
          >
            {ICONS.fillet}
            필렛
          </button>
        </nav>

        <div className="canvas-area">
          {mobilePanelOpen && <div className="side-panel-backdrop" onClick={() => setMobilePanelOpen(false)} />}
          <button className="panel-fab" onClick={() => setMobilePanelOpen((v) => !v)}>
            {mobilePanelOpen ? '✕' : '⚙'}
          </button>
          <div className="canvas-scroll">
            <svg
              ref={svgRef}
              className="pattern-sheet"
              viewBox={`0 0 ${sheet.w} ${sheet.h}`}
              width={sheet.w * zoom}
              height={sheet.h * zoom}
              style={{ '--sheet-w-mm': sheet.w, '--sheet-h-mm': sheet.h }}
              onMouseDown={handleSheetMouseDown}
              onMouseMove={handleSheetMouseMove}
              onMouseUp={handleSheetMouseUp}
              onMouseLeave={() => { setCursorMm(null); setMarquee(null); moveRef.current = null; resizeRef.current = null; setSnapTarget(null) }}
              onTouchStart={(e) => {
                if (e.touches.length >= 2) {
                  e.preventDefault()
                  const s = e.currentTarget.parentElement
                  const t1 = e.touches[0], t2 = e.touches[1]
                  panRef.current = {
                    active: true,
                    startScrollX: s.scrollLeft,
                    startScrollY: s.scrollTop,
                    startX: (t1.clientX + t2.clientX) / 2,
                    startY: (t1.clientY + t2.clientY) / 2,
                  }
                  return
                }
                if (panRef.current.active) return
                e.preventDefault()
                const t = touchEvent(e)
                handleSheetMouseDown({ ...e, clientX: t.clientX, clientY: t.clientY })
              }}
              onTouchMove={(e) => {
                if (panRef.current.active) {
                  if (e.touches.length >= 2) {
                    const t1 = e.touches[0], t2 = e.touches[1]
                    const cx = (t1.clientX + t2.clientX) / 2
                    const cy = (t1.clientY + t2.clientY) / 2
                    const s = e.currentTarget.parentElement
                    s.scrollLeft = panRef.current.startScrollX - (cx - panRef.current.startX)
                    s.scrollTop = panRef.current.startScrollY - (cy - panRef.current.startY)
                  }
                  e.preventDefault()
                  return
                }
                e.preventDefault()
                const t = touchEvent(e)
                handleSheetMouseMove({ ...e, clientX: t.clientX, clientY: t.clientY })
              }}
              onTouchEnd={(e) => {
                if (panRef.current.active) {
                  if (e.touches.length === 0) panRef.current.active = false
                  if (e.changedTouches.length > 0) e.preventDefault()
                  return
                }
                const t = touchEvent(e)
                handleSheetMouseUp({ ...e, clientX: t.clientX, clientY: t.clientY })
              }}
              onTouchCancel={() => { panRef.current.active = false }}
            >
              <rect x={0} y={0} width={sheet.w} height={sheet.h} fill="var(--paper)" />
              {backgroundImage && (
                <image x={0} y={0} width={sheet.w} height={sheet.h} preserveAspectRatio="xMidYMid slice" href={backgroundImage} opacity={0.6} />
              )}
              {gridLines}

              {cornerTicks.map(([cx, cy], i) => (
                <g key={i} className="sheet-corner-tick">
                  <line x1={cx - 4} y1={cy} x2={cx + 4} y2={cy} />
                  <line x1={cx} y1={cy - 4} x2={cx} y2={cy + 4} />
                  <circle cx={cx} cy={cy} r={2.4} fill="none" />
                </g>
              ))}
              <line className="centerline" x1={0} y1={cy} x2={sheet.w} y2={cy} />
              <line className="centerline" x1={cx} y1={0} x2={cx} y2={sheet.h} />

              {shapes.map((s) => {
                const isActive = selectedIds.length === 0 && s.id === selectedId
                const isMultiSel = !isActive && selSet.has(s.id)
                const stroke = isActive ? '#c1443c' : isMultiSel ? '#4a9eff' : INK
                return (
                  <g
                    key={s.id}
                    data-testid="shape"
                    onMouseDown={(e) => handleShapeDown(e, s, selSet)}
                    onTouchStart={(e) => handleShapeDown(e, s, selSet)}
                    style={{ cursor: tool === 'select' ? 'pointer' : 'crosshair' }}
                  >
                    {s.type === 'line' ? (
                      <>
                        <line x1={s.x1} y1={s.y1} x2={s.x2} y2={s.y2} stroke="transparent" strokeWidth={6} />
                        <line x1={s.x1} y1={s.y1} x2={s.x2} y2={s.y2} stroke={stroke} strokeWidth={STROKE_MM} strokeLinecap="round" />
                      </>
                    ) : s.type === 'arc' ? (
                      <>
                        <path
                          d={`M ${s.x1},${s.y1} A ${s.r},${s.r} 0 0 ${s.sweep} ${s.x2},${s.y2}`}
                          fill="none" stroke="transparent" strokeWidth={6}
                        />
                        <path
                          d={`M ${s.x1},${s.y1} A ${s.r},${s.r} 0 0 ${s.sweep} ${s.x2},${s.y2}`}
                          fill="none" stroke={stroke} strokeWidth={STROKE_MM} strokeLinecap="round"
                        />
                      </>
                    ) : (
                      <>
                        <path
                          d={`M ${s.x1},${s.y1} C ${s.c1x},${s.c1y} ${s.c2x},${s.c2y} ${s.x2},${s.y2}`}
                          fill="none"
                          stroke="transparent"
                          strokeWidth={6}
                        />
                        <path
                          d={`M ${s.x1},${s.y1} C ${s.c1x},${s.c1y} ${s.c2x},${s.c2y} ${s.x2},${s.y2}`}
                          fill="none"
                          stroke={stroke}
                          strokeWidth={STROKE_MM}
                          strokeLinecap="round"
                        />
                      </>
                    )}

                    {isActive && s.type === 'curve' && (
                      <>
                        <line x1={s.x1} y1={s.y1} x2={s.c1x} y2={s.c1y} stroke="#e3b23c" strokeWidth={0.4} strokeDasharray="1.5 1.5" />
                        <line x1={s.x2} y1={s.y2} x2={s.c2x} y2={s.c2y} stroke="#e3b23c" strokeWidth={0.4} strokeDasharray="1.5 1.5" />
                      </>
                    )}
                    {isActive && s.type === 'arc' && (() => {
                      const mp = dragging?.handle === 'r' && arcHandlePos ? arcHandlePos : arcMidpoint(s.x1, s.y1, s.x2, s.y2, s.r, s.sweep)
                      if (!mp) return null
                      return (
                        <line x1={(s.x1 + s.x2) / 2} y1={(s.y1 + s.y2) / 2} x2={mp.x} y2={mp.y} stroke="#e3b23c" strokeWidth={0.4} strokeDasharray="1.5 1.5" />
                      )
                    })()}

                    {isActive && (
                      <>
                        <Handle x={s.x1} y={s.y1} onDown={() => { saveForUndo(); setDragging({ handle: 'p1' }) }} />
                        <Handle x={s.x2} y={s.y2} onDown={() => { saveForUndo(); setDragging({ handle: 'p2' }) }} />
                        {s.type === 'curve' && (
                          <>
                            <Handle x={s.c1x} y={s.c1y} gold onDown={() => { saveForUndo(); setDragging({ handle: 'c1' }) }} />
                            <Handle x={s.c2x} y={s.c2y} gold onDown={() => { saveForUndo(); setDragging({ handle: 'c2' }) }} />
                          </>
                        )}
                        {s.type === 'arc' && (() => {
                          const mp = dragging?.handle === 'r' && arcHandlePos ? arcHandlePos : arcMidpoint(s.x1, s.y1, s.x2, s.y2, s.r, s.sweep)
                          if (!mp) return null
                          return (
                            <Handle x={mp.x} y={mp.y} gold onDown={(cx, cy) => { 
                              saveForUndo()
                              const mm = clientToMm(cx, cy)
                              setDragging({ handle: 'r' })
                              arcDragRef.current = { startR: s.r, mouseX: mm.x, mouseY: mm.y }
                            }} />
                          )
                        })()}
                      </>
                    )}
                  </g>
                )
              })}

              {draft && (
                draft.type === 'line' ? (
                  <line x1={draft.x1} y1={draft.y1} x2={draft.x2} y2={draft.y2} stroke="#c1443c" strokeWidth={0.7} strokeDasharray="2 1.5" />
                ) : (
                  <line x1={draft.x1} y1={draft.y1} x2={draft.x2} y2={draft.y2} stroke="#c1443c" strokeWidth={0.7} strokeDasharray="2 1.5" />
                )
              )}

              {selectionBounds && tool === 'select' && selectedIds.length > 1 && (
                <>
                  <rect
                    x={selectionBounds.x}
                    y={selectionBounds.y}
                    width={selectionBounds.w}
                    height={selectionBounds.h}
                    fill="none"
                    stroke="#4a9eff"
                    strokeWidth={0.3}
                    strokeDasharray="2 1.5"
                  />
                  {['nw','n','ne','e','se','s','sw','w'].map((h) => {
                    let hx, hy
                    switch (h) {
                      case 'nw': hx = selectionBounds.x; hy = selectionBounds.y; break
                      case 'n': hx = selectionBounds.x + selectionBounds.w / 2; hy = selectionBounds.y; break
                      case 'ne': hx = selectionBounds.x + selectionBounds.w; hy = selectionBounds.y; break
                      case 'e': hx = selectionBounds.x + selectionBounds.w; hy = selectionBounds.y + selectionBounds.h / 2; break
                      case 'se': hx = selectionBounds.x + selectionBounds.w; hy = selectionBounds.y + selectionBounds.h; break
                      case 's': hx = selectionBounds.x + selectionBounds.w / 2; hy = selectionBounds.y + selectionBounds.h; break
                      case 'sw': hx = selectionBounds.x; hy = selectionBounds.y + selectionBounds.h; break
                      case 'w': hx = selectionBounds.x; hy = selectionBounds.y + selectionBounds.h / 2; break
                    }
                    const cursors = { nw: 'nw-resize', n: 'n-resize', ne: 'ne-resize', e: 'e-resize', se: 'se-resize', s: 's-resize', sw: 'sw-resize', w: 'w-resize' }
                    return (
                      <rect
                        key={h}
                        x={hx - 2.5}
                        y={hy - 2.5}
                        width={5}
                        height={5}
                        fill="#fff"
                        stroke="#4a9eff"
                        strokeWidth={0.5}
                        style={{ cursor: cursors[h] }}
                        onMouseDown={(e) => { e.stopPropagation(); handleResizeStart(e.clientX, e.clientY, h) }}
                        onTouchStart={(e) => { e.preventDefault(); e.stopPropagation(); const t = e.touches[0]; handleResizeStart(t.clientX, t.clientY, h) }}
                      />
                    )
                  })}
                </>
              )}

              {marquee && (
                <rect
                  x={Math.min(marquee.x1, marquee.x2)}
                  y={Math.min(marquee.y1, marquee.y2)}
                  width={Math.abs(marquee.x2 - marquee.x1)}
                  height={Math.abs(marquee.y2 - marquee.y1)}
                  fill="rgba(227, 178, 60, 0.08)"
                  stroke="#e3b23c"
                  strokeWidth={0.5}
                  strokeDasharray="2 1.5"
                />
              )}

              {seamPath && (
                <path className="seam-allowance" d={seamPath} />
              )}

              {closureStatus.openPoints.map((p, i) => (
                <circle key={`open${i}`} className="open-point-marker" cx={p.x} cy={p.y} r={3.4} fill="none" stroke="#c1443c" strokeWidth={0.8} />
              ))}

              {snapTarget && (
                <circle cx={snapTarget.x} cy={snapTarget.y} r={4.2} fill="none" stroke="#e3b23c" strokeWidth={0.9} />
              )}
            </svg>
          </div>

          <div className="status-bar">
            <span>
              도구: <strong>{tool === 'select' ? '선택' : tool === 'line' ? '직선' : '곡선'}</strong>
            </span>
            <span>
              좌표: <strong>{cursorMm ? `${(cursorMm.x / 10).toFixed(1)}, ${(cursorMm.y / 10).toFixed(1)} cm` : '—'}</strong>
            </span>
            <span>
              확대: <strong>{zoom}px/mm</strong>
            </span>
            <span onClick={() => setStatusTooltip(statusTooltip === statusText ? null : statusText)} style={{ cursor: 'pointer' }}>
              {selectedIds.length > 1 ? (
                <strong style={{ color: '#4a9eff' }}>{selectedIds.length}개 선택됨</strong>
              ) : closureStatus.closed ? (
                <strong style={{ color: '#8fbf6c' }}>폐곡선 완성 ✓</strong>
              ) : shapes.length ? (
                <strong style={{ color: '#c1443c' }}>열린 점 {closureStatus.openPoints.length}개 — 이어서 그려야 저장 가능</strong>
              ) : (
                '폐곡선을 그리면 저장할 수 있습니다'
              )}
            </span>
            <div style={{ flex: 1 }} />
            <div className="field-row" style={{ gap: 4 }}>
              <button className="btn btn-ghost" style={{ padding: '3px 8px' }} onClick={zoomToFit} title="전체 축소">
                전체축소
              </button>
              <button className="btn btn-ghost" style={{ padding: '3px 8px' }} onClick={zoomReset} title="기본 확대">
                기본확대
              </button>
              {ZOOM_STEPS.map((z) => (
                <button key={z} className="btn btn-ghost" style={{ padding: '3px 8px' }} onClick={() => setZoom(z)}>
                  {z}×
                </button>
              ))}
            </div>
          </div>
        </div>

        <aside className={`side-panel${mobilePanelOpen ? ' open' : ''}`}>
          <div className="panel-tabs">
            <button className={`panel-tab ${panelTab === 'properties' ? 'active' : ''}`} onClick={() => setPanelTab('properties')}>
              속성
            </button>
            <button className={`panel-tab ${panelTab === 'library' ? 'active' : ''}`} onClick={() => setPanelTab('library')}>
              보관함
            </button>
            <button className="panel-tab panel-tab-close" onClick={() => setMobilePanelOpen(false)}>
              ✕
            </button>
          </div>

          <div className="panel-body">
            {panelTab === 'properties' ? (
              <PropertiesPanel
                sheetKey={sheetKey}
                onSheetChange={(k) => {
                  if (shapes.length && !window.confirm('용지 크기를 바꾸면 화면 배치가 달라질 수 있습니다. 계속할까요?')) return
                  setSheetKey(k)
                }}
                customW={customW}
                customH={customH}
                onCustomSheetChange={handleCustomSheetChange}
                minSheetMm={MIN_SHEET_MM}
                maxSheetMm={MAX_SHEET_MM}
                shapes={shapes}
                selectedShape={selectedShape}
                selectedId={selectedId}
                multiCount={selectedIds.length > 1 ? selectedIds.length : 0}
                selectionBounds={selectionBounds}
                onSelect={(id) => setSelectedId(id)}
                onDelete={deleteShape}
                onLengthChange={setLineLengthCm}
                onResizeBounds={(nbw, nbh) => {
                  const ids = selectedIds.length > 0 ? new Set(selectedIds) : (selectedId ? new Set([selectedId]) : null)
                  if (!ids || !selectionBounds) return
                  saveForUndo()
                  scaleShapes([...ids], selectionBounds, selectionBounds.x, selectionBounds.y, nbw, nbh)
                }}
                closureStatus={closureStatus}
                backgroundImage={backgroundImage}
                onBackgroundUpload={handleBackgroundUpload}
                onBackgroundRemove={removeBackground}
                includeBgExport={includeBgExport}
                onToggleBgExport={() => setIncludeBgExport((v) => !v)}
                transparentBgExport={transparentBgExport}
                onToggleTransparentBg={() => setTransparentBgExport((v) => !v)}
                seamEnabled={seamEnabled}
                onToggleSeam={() => setSeamEnabled((v) => !v)}
                seamWidth={seamWidth}
                onSeamWidthChange={setSeamWidth}
                filletCurvature={filletCurvature}
                onFilletCurvatureChange={setFilletCurvature}
                canApplyFillet={canApplyFillet}
                onApplyFillet={applyFillet}
                onArcRadiusChange={setArcRadius}
              />
            ) : (
              <LibraryPanel savedPatterns={savedPatterns} onLoad={loadPattern} onDelete={deleteSavedPattern} />
            )}
          </div>
        </aside>
      </div>

      {statusTooltip && (
        <div className="status-tooltip" onClick={(e) => { e.stopPropagation(); setStatusTooltip(null) }}>
          {statusTooltip}
        </div>
      )}

      {showSaveModal && (
        <SaveModal
          saveName={saveName}
          onNameChange={setSaveName}
          onConfirm={confirmSave}
          onCancel={() => setShowSaveModal(false)}
        />
      )}
    </div>
  )
}
