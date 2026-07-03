import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'

/* ------------------------------------------------------------------ */
/*  Constants                                                          */
/* ------------------------------------------------------------------ */

const SHEET_PRESETS = {
  block: { label: '패턴 블록 (400×300mm)', w: 400, h: 300 },
  a4: { label: 'A4 (210×297mm)', w: 210, h: 297 },
  a3: { label: 'A3 (297×420mm)', w: 297, h: 420 },
}

const ZOOM_STEPS = [1, 1.5, 2, 3, 4, 6]
const DEFAULT_ZOOM = 3 // on-screen px per mm — print size is independent of this
const GRID_MM = 10 // 1cm grid
const GRID_BOLD_EVERY = 5 // bold line every 5cm
const MIN_DRAG_MM = 2 // ignore accidental clicks shorter than this
const STORAGE_KEY = 'furboaee_patterns_v1'

const INK = '#241f18'
const STROKE_MM = 0.7

/* ------------------------------------------------------------------ */
/*  Geometry helpers                                                   */
/* ------------------------------------------------------------------ */

function dist(x1, y1, x2, y2) {
  return Math.hypot(x2 - x1, y2 - y1)
}

function makeDefaultCurve(x1, y1, x2, y2) {
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

function cubicPoint(t, p0, p1, p2, p3) {
  const mt = 1 - t
  return mt * mt * mt * p0 + 3 * mt * mt * t * p1 + 3 * mt * t * t * p2 + t * t * t * p3
}

function curveLengthMm(s, steps = 40) {
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

function shapeToSvgEl(s) {
  if (s.type === 'line') {
    return `<line x1="${s.x1.toFixed(2)}" y1="${s.y1.toFixed(2)}" x2="${s.x2.toFixed(2)}" y2="${s.y2.toFixed(2)}" stroke="${INK}" stroke-width="${STROKE_MM}" stroke-linecap="round"/>`
  }
  return `<path d="M ${s.x1.toFixed(2)},${s.y1.toFixed(2)} C ${s.c1x.toFixed(2)},${s.c1y.toFixed(2)} ${s.c2x.toFixed(2)},${s.c2y.toFixed(2)} ${s.x2.toFixed(2)},${s.y2.toFixed(2)}" fill="none" stroke="${INK}" stroke-width="${STROKE_MM}" stroke-linecap="round"/>`
}

function buildSvgString(shapes, wMm, hMm) {
  const body = shapes.map(shapeToSvgEl).join('\n  ')
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${wMm} ${hMm}" width="${(wMm / 10).toFixed(2)}cm" height="${(hMm / 10).toFixed(2)}cm">
  <rect x="0" y="0" width="${wMm}" height="${hMm}" fill="#ffffff"/>
  ${body}
</svg>`
}

function downloadBlob(filename, blob) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}

function uid() {
  return Math.random().toString(36).slice(2, 10)
}

/* ------------------------------------------------------------------ */
/*  Small presentational bits                                          */
/* ------------------------------------------------------------------ */

function BrandMark() {
  return (
    <svg viewBox="0 0 40 40" className="brand-mark" aria-hidden="true">
      <circle cx="20" cy="20" r="19" fill="#0b0b0c" stroke="#e3b23c" strokeWidth="1.4" />
      <path
        d="M9 24c4-6 9-10 11-10s2 2-1 5-9 8-8 10 6-1 10-5 4-8 3-9"
        fill="none"
        stroke="#e3b23c"
        strokeWidth="1.4"
        strokeLinecap="round"
      />
      <circle cx="12" cy="26" r="1.3" fill="#e3b23c" />
      <circle cx="28" cy="14" r="1.3" fill="#e3b23c" />
    </svg>
  )
}

const ICONS = {
  select: (
    <svg viewBox="0 0 24 24" fill="none">
      <path d="M5 3l5.5 15 2-6.5L19 9.5 5 3z" strokeWidth="1.6" strokeLinejoin="round" />
    </svg>
  ),
  line: (
    <svg viewBox="0 0 24 24" fill="none">
      <circle cx="5" cy="19" r="1.6" fill="currentColor" stroke="none" />
      <circle cx="19" cy="5" r="1.6" fill="currentColor" stroke="none" />
      <path d="M5 19L19 5" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  ),
  curve: (
    <svg viewBox="0 0 24 24" fill="none">
      <circle cx="4" cy="19" r="1.6" fill="currentColor" stroke="none" />
      <circle cx="20" cy="6" r="1.6" fill="currentColor" stroke="none" />
      <path d="M4 19C10 19 8 6 20 6" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  ),
  trash: (
    <svg viewBox="0 0 24 24" fill="none">
      <path d="M4 7h16M9 7V5a1 1 0 011-1h4a1 1 0 011 1v2m-9 0l1 13a1 1 0 001 1h8a1 1 0 001-1l1-13" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  seam: (
    <svg viewBox="0 0 24 24" fill="none">
      <path d="M4 18L20 6" strokeWidth="1.4" strokeDasharray="2 2" />
      <path d="M4 21L20 9" strokeWidth="1.4" />
    </svg>
  ),
}

/* ------------------------------------------------------------------ */
/*  Main app                                                            */
/* ------------------------------------------------------------------ */

export default function App() {
  const [sheetKey, setSheetKey] = useState('block')
  const sheet = SHEET_PRESETS[sheetKey]

  const [shapes, setShapes] = useState([])
  const [selectedId, setSelectedId] = useState(null)
  const [tool, setTool] = useState('line')
  const [zoom, setZoom] = useState(DEFAULT_ZOOM)
  const [panelTab, setPanelTab] = useState('properties')
  const [cursorMm, setCursorMm] = useState(null)

  const [draft, setDraft] = useState(null) // shape being drawn
  const dragStartRef = useRef(null)
  const [dragging, setDragging] = useState(null) // {handle} while editing a handle

  const [savedPatterns, setSavedPatterns] = useState([])
  const [showSaveModal, setShowSaveModal] = useState(false)
  const [saveName, setSaveName] = useState('')

  const svgRef = useRef(null)

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

  /* ---------------- drawing new shapes ---------------- */

  function handleSheetMouseDown(e) {
    if (tool === 'select') return
    const { x, y } = clientToMm(e.clientX, e.clientY)
    dragStartRef.current = { x, y }
    setDraft({ type: tool, x1: x, y1: y, x2: x, y2: y })
  }

  function handleSheetMouseMove(e) {
    const { x, y } = clientToMm(e.clientX, e.clientY)
    setCursorMm({ x, y })

    if (draft && dragStartRef.current) {
      setDraft((d) => ({ ...d, x2: x, y2: y }))
      return
    }
    if (dragging && selectedId) {
      updateHandle(selectedId, dragging.handle, x, y)
    }
  }

  function handleSheetMouseUp() {
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
        setShapes((prev) => [...prev, newShape])
        setSelectedId(id)
        setPanelTab('properties')
        if (draft.type === 'curve') setTool('select')
      }
      setDraft(null)
      dragStartRef.current = null
    }
    if (dragging) setDragging(null)
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
        return s
      }),
    )
  }

  function setLineLengthCm(id, newLenCm) {
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
    setShapes((prev) => prev.filter((s) => s.id !== id))
    if (selectedId === id) setSelectedId(null)
  }

  useEffect(() => {
    function onKeyDown(e) {
      const tag = document.activeElement?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA') return
      if ((e.key === 'Delete' || e.key === 'Backspace') && selectedId) {
        e.preventDefault()
        deleteShape(selectedId)
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [selectedId])

  const selectedShape = useMemo(() => shapes.find((s) => s.id === selectedId) || null, [shapes, selectedId])

  /* ---------------- file actions ---------------- */

  function handleNewPattern() {
    if (shapes.length && !window.confirm('현재 캔버스를 비웁니다. 저장하지 않은 작업은 사라집니다. 계속할까요?')) return
    setShapes([])
    setSelectedId(null)
  }

  function handleExportSvg() {
    const svg = buildSvgString(shapes, sheet.w, sheet.h)
    downloadBlob(`furboaee-pattern-${Date.now()}.svg`, new Blob([svg], { type: 'image/svg+xml' }))
  }

  function handleExportPng() {
    const svg = buildSvgString(shapes, sheet.w, sheet.h)
    const blob = new Blob([svg], { type: 'image/svg+xml' })
    const url = URL.createObjectURL(blob)
    const img = new Image()
    img.onload = () => {
      const PX_PER_MM = 150 / 25.4 // ~150 dpi raster for a crisp print-quality PNG
      const canvas = document.createElement('canvas')
      canvas.width = Math.round(sheet.w * PX_PER_MM)
      canvas.height = Math.round(sheet.h * PX_PER_MM)
      const ctx = canvas.getContext('2d')
      ctx.fillStyle = '#ffffff'
      ctx.fillRect(0, 0, canvas.width, canvas.height)
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
      URL.revokeObjectURL(url)
      canvas.toBlob((pngBlob) => downloadBlob(`furboaee-pattern-${Date.now()}.png`, pngBlob), 'image/png')
    }
    img.src = url
  }

  function handlePrint() {
    window.print()
  }

  function openSaveModal() {
    setSaveName(`패턴 ${new Date().toLocaleDateString('ko-KR')}`)
    setShowSaveModal(true)
  }

  function confirmSave() {
    const name = saveName.trim() || '이름 없는 패턴'
    const entry = {
      id: uid(),
      name,
      createdAt: Date.now(),
      sheetKey,
      shapes,
      svg: buildSvgString(shapes, sheet.w, sheet.h),
    }
    persist([entry, ...savedPatterns])
    setShowSaveModal(false)
  }

  function loadPattern(entry) {
    if (shapes.length && !window.confirm('현재 캔버스의 작업을 덮어씁니다. 계속할까요?')) return
    setSheetKey(entry.sheetKey && SHEET_PRESETS[entry.sheetKey] ? entry.sheetKey : 'block')
    setShapes(entry.shapes.map((s) => ({ ...s })))
    setSelectedId(null)
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

  /* ---------------- render ---------------- */

  return (
    <div className="app">
      <header className="app-header">
        <div className="brand">
          <BrandMark />
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
          <button className="btn" onClick={handleExportSvg} disabled={!shapes.length}>
            SVG 저장
          </button>
          <button className="btn" onClick={handleExportPng} disabled={!shapes.length}>
            PNG 내보내기
          </button>
          <button className="btn" onClick={handlePrint} disabled={!shapes.length}>
            인쇄 (1:1)
          </button>
          <button className="btn btn-gold" onClick={openSaveModal} disabled={!shapes.length}>
            보관함에 저장
          </button>
        </div>
      </header>

      <div className="app-body">
        <nav className="toolbar">
          <button
            className={`tool-btn ${tool === 'select' ? 'active' : ''}`}
            onClick={() => setTool('select')}
            title="선택 / 편집"
          >
            {ICONS.select}
            선택
          </button>
          <button className={`tool-btn ${tool === 'line' ? 'active' : ''}`} onClick={() => setTool('line')} title="직선 그리기">
            {ICONS.line}
            직선
          </button>
          <button className={`tool-btn ${tool === 'curve' ? 'active' : ''}`} onClick={() => setTool('curve')} title="곡선 그리기">
            {ICONS.curve}
            곡선
          </button>

          <div className="toolbar-divider" />

          <button
            className="tool-btn"
            onClick={() => selectedId && deleteShape(selectedId)}
            disabled={!selectedId}
            title="선택한 요소 삭제"
          >
            {ICONS.trash}
            삭제
          </button>

          <div className="toolbar-divider" />

          <button className="tool-btn" disabled title="시접 자동 생성 — 다음 버전 예정">
            {ICONS.seam}
            시접
          </button>
        </nav>

        <div className="canvas-area">
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
              onMouseLeave={() => setCursorMm(null)}
            >
              <rect x={0} y={0} width={sheet.w} height={sheet.h} fill="var(--paper)" />
              {gridLines}

              {cornerTicks.map(([cx, cy], i) => (
                <g key={i} className="sheet-corner-tick">
                  <line x1={cx - 4} y1={cy} x2={cx + 4} y2={cy} />
                  <line x1={cx} y1={cy - 4} x2={cx} y2={cy + 4} />
                  <circle cx={cx} cy={cy} r={2.4} fill="none" />
                </g>
              ))}

              {shapes.map((s) => {
                const isSelected = s.id === selectedId
                const stroke = isSelected ? '#c1443c' : INK
                return (
                  <g
                    key={s.id}
                    onMouseDown={(e) => {
                      if (tool !== 'select') return
                      e.stopPropagation()
                      setSelectedId(s.id)
                      setPanelTab('properties')
                    }}
                    style={{ cursor: tool === 'select' ? 'pointer' : 'crosshair' }}
                  >
                    {/* fat invisible hit area for easier selection */}
                    {s.type === 'line' ? (
                      <>
                        <line x1={s.x1} y1={s.y1} x2={s.x2} y2={s.y2} stroke="transparent" strokeWidth={6} />
                        <line x1={s.x1} y1={s.y1} x2={s.x2} y2={s.y2} stroke={stroke} strokeWidth={STROKE_MM} strokeLinecap="round" />
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

                    {isSelected && s.type === 'curve' && (
                      <>
                        <line x1={s.x1} y1={s.y1} x2={s.c1x} y2={s.c1y} stroke="#e3b23c" strokeWidth={0.4} strokeDasharray="1.5 1.5" />
                        <line x1={s.x2} y1={s.y2} x2={s.c2x} y2={s.c2y} stroke="#e3b23c" strokeWidth={0.4} strokeDasharray="1.5 1.5" />
                      </>
                    )}

                    {isSelected && (
                      <>
                        <Handle x={s.x1} y={s.y1} onDown={() => setDragging({ handle: 'p1' })} />
                        <Handle x={s.x2} y={s.y2} onDown={() => setDragging({ handle: 'p2' })} />
                        {s.type === 'curve' && (
                          <>
                            <Handle x={s.c1x} y={s.c1y} gold onDown={() => setDragging({ handle: 'c1' })} />
                            <Handle x={s.c2x} y={s.c2y} gold onDown={() => setDragging({ handle: 'c2' })} />
                          </>
                        )}
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
            <div style={{ flex: 1 }} />
            <div className="field-row" style={{ gap: 4 }}>
              {ZOOM_STEPS.map((z) => (
                <button key={z} className="btn btn-ghost" style={{ padding: '3px 8px' }} onClick={() => setZoom(z)}>
                  {z}×
                </button>
              ))}
            </div>
          </div>
        </div>

        <aside className="side-panel">
          <div className="panel-tabs">
            <button className={`panel-tab ${panelTab === 'properties' ? 'active' : ''}`} onClick={() => setPanelTab('properties')}>
              속성
            </button>
            <button className={`panel-tab ${panelTab === 'library' ? 'active' : ''}`} onClick={() => setPanelTab('library')}>
              보관함
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
                shapes={shapes}
                selectedShape={selectedShape}
                selectedId={selectedId}
                onSelect={(id) => setSelectedId(id)}
                onDelete={deleteShape}
                onLengthChange={setLineLengthCm}
              />
            ) : (
              <LibraryPanel savedPatterns={savedPatterns} onLoad={loadPattern} onDelete={deleteSavedPattern} />
            )}
          </div>
        </aside>
      </div>

      {showSaveModal && (
        <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && setShowSaveModal(false)}>
          <div className="modal">
            <h3>보관함에 저장</h3>
            <div className="field">
              <label>패턴 이름</label>
              <input
                type="text"
                value={saveName}
                autoFocus
                onChange={(e) => setSaveName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && confirmSave()}
              />
            </div>
            <div className="modal-actions">
              <button className="btn" onClick={() => setShowSaveModal(false)}>
                취소
              </button>
              <button className="btn btn-gold" onClick={confirmSave}>
                저장
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  Handle (draggable control point)                                   */
/* ------------------------------------------------------------------ */

function Handle({ x, y, gold, onDown }) {
  return (
    <circle
      cx={x}
      cy={y}
      r={2.6}
      fill={gold ? '#e3b23c' : '#c1443c'}
      stroke="#0b0b0c"
      strokeWidth={0.5}
      style={{ cursor: 'grab' }}
      onMouseDown={(e) => {
        e.stopPropagation()
        onDown()
      }}
    />
  )
}

/* ------------------------------------------------------------------ */
/*  Properties panel                                                    */
/* ------------------------------------------------------------------ */

function PropertiesPanel({ sheetKey, onSheetChange, shapes, selectedShape, selectedId, onSelect, onDelete, onLengthChange }) {
  return (
    <>
      <p className="panel-section-title">용지 크기</p>
      <div className="field">
        <select
          value={sheetKey}
          onChange={(e) => onSheetChange(e.target.value)}
          style={{
            width: '100%',
            padding: '8px 10px',
            background: 'var(--charcoal-2)',
            border: '1px solid var(--charcoal-3)',
            color: 'var(--paper)',
            borderRadius: 3,
            fontFamily: 'var(--font-mono)',
            fontSize: 12.5,
          }}
        >
          {Object.entries(SHEET_PRESETS).map(([k, v]) => (
            <option key={k} value={k}>
              {v.label}
            </option>
          ))}
        </select>
      </div>

      <p className="panel-section-title" style={{ marginTop: 20 }}>
        선택한 요소
      </p>

      {!selectedShape && <p className="empty-hint">캔버스에서 직선 또는 곡선을 클릭해 선택하세요. 선택 도구가 켜져 있어야 합니다.</p>}

      {selectedShape && selectedShape.type === 'line' && (
        <>
          <div className="field">
            <label>길이 (cm)</label>
            <input
              type="number"
              step="0.1"
              min="0.1"
              value={(Math.hypot(selectedShape.x2 - selectedShape.x1, selectedShape.y2 - selectedShape.y1) / 10).toFixed(1)}
              onChange={(e) => onLengthChange(selectedShape.id, parseFloat(e.target.value) || 0)}
            />
          </div>
          <button className="btn btn-danger" onClick={() => onDelete(selectedShape.id)}>
            이 요소 삭제
          </button>
        </>
      )}

      {selectedShape && selectedShape.type === 'curve' && (
        <>
          <div className="field">
            <label>대략 길이 (cm)</label>
            <input type="text" readOnly value={(curveLengthMm(selectedShape) / 10).toFixed(1)} />
          </div>
          <p className="empty-hint">금색 손잡이(조절점)를 드래그하면 곡률이 바뀝니다. 빨간 손잡이는 끝점입니다.</p>
          <button className="btn btn-danger" onClick={() => onDelete(selectedShape.id)}>
            이 요소 삭제
          </button>
        </>
      )}

      {shapes.length > 0 && (
        <>
          <p className="panel-section-title" style={{ marginTop: 22 }}>
            전체 요소 ({shapes.length})
          </p>
          <ul className="shape-list">
            {shapes.map((s, i) => (
              <li key={s.id} className={`shape-row ${s.id === selectedId ? 'selected' : ''}`} onClick={() => onSelect(s.id)}>
                <span>
                  <span className="tag">{s.type === 'line' ? '직선' : '곡선'}</span>#{i + 1}
                </span>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--muted)' }}>
                  {(s.type === 'line' ? Math.hypot(s.x2 - s.x1, s.y2 - s.y1) : curveLengthMm(s)) / 10 | 0}cm
                </span>
              </li>
            ))}
          </ul>
        </>
      )}

      <div className="roadmap-note">
        <strong>다음 버전 예정:</strong> 시접 자동 생성, 태블릿 펜 압력 인식, 패턴 사진 AI 분석, 버전 관리, 여러 장 분할 인쇄
      </div>
    </>
  )
}

/* ------------------------------------------------------------------ */
/*  Library panel                                                       */
/* ------------------------------------------------------------------ */

function LibraryPanel({ savedPatterns, onLoad, onDelete }) {
  if (!savedPatterns.length) {
    return <p className="empty-hint">아직 저장된 패턴이 없습니다. 상단의 “보관함에 저장” 버튼으로 현재 작업을 저장하세요.</p>
  }
  return (
    <ul className="saved-list">
      {savedPatterns.map((p) => (
        <li key={p.id} className="saved-row">
          <div className="saved-row-top">
            <span className="saved-row-name">{p.name}</span>
          </div>
          <div className="saved-row-meta">
            {new Date(p.createdAt).toLocaleString('ko-KR')} · 요소 {p.shapes.length}개
          </div>
          <div className="saved-row-actions">
            <button className="btn btn-gold" onClick={() => onLoad(p)}>
              불러오기
            </button>
            <button className="btn btn-danger" onClick={() => onDelete(p.id)}>
              삭제
            </button>
          </div>
        </li>
      ))}
    </ul>
  )
}
