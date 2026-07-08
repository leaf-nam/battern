import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import { SHEET_PRESETS, ZOOM_STEPS, DEFAULT_ZOOM, GRID_MM, GRID_BOLD_EVERY, MIN_DRAG_MM, STORAGE_KEY, INK, STROKE_MM } from './constants.js'
import { dist, makeDefaultCurve, findSnapTarget } from './utils/geometry.js'
import { computeClosure } from './utils/closure.js'
import { buildSvgString, downloadBlob } from './utils/svg.js'
import { uid } from './utils/uid.js'
import { BrandMark, ICONS } from './icons.jsx'
import Handle from './components/Handle.jsx'
import PropertiesPanel from './components/PropertiesPanel.jsx'
import LibraryPanel from './components/LibraryPanel.jsx'
import SaveModal from './components/SaveModal.jsx'

export default function App() {
  const [sheetKey, setSheetKey] = useState('block')
  const sheet = SHEET_PRESETS[sheetKey]

  const [shapes, setShapes] = useState([])
  const [selectedId, setSelectedId] = useState(null)
  const [tool, setTool] = useState('line')
  const [zoom, setZoom] = useState(DEFAULT_ZOOM)
  const [panelTab, setPanelTab] = useState('properties')
  const [cursorMm, setCursorMm] = useState(null)

  const [draft, setDraft] = useState(null)
  const dragStartRef = useRef(null)
  const [dragging, setDragging] = useState(null)
  const [snapTarget, setSnapTarget] = useState(null)

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
    let { x, y } = clientToMm(e.clientX, e.clientY)
    const snap = findSnapTarget(shapes, null, x, y)
    if (snap) ({ x, y } = snap)
    dragStartRef.current = { x, y }
    setDraft({ type: tool, x1: x, y1: y, x2: x, y2: y })
    setSnapTarget(snap)
  }

  function handleSheetMouseMove(e) {
    let { x, y } = clientToMm(e.clientX, e.clientY)
    setCursorMm({ x, y })

    if (draft && dragStartRef.current) {
      const snap = findSnapTarget(shapes, null, x, y)
      if (snap) ({ x, y } = snap)
      setSnapTarget(snap)
      setDraft((d) => ({ ...d, x2: x, y2: y }))
      return
    }
    if (dragging && selectedId) {
      if (dragging.handle === 'p1' || dragging.handle === 'p2') {
        const snap = findSnapTarget(shapes, selectedId, x, y)
        if (snap) ({ x, y } = snap)
        setSnapTarget(snap)
      } else {
        setSnapTarget(null)
      }
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
  const closureStatus = useMemo(() => computeClosure(shapes), [shapes])
  const canSave = shapes.length > 0 && closureStatus.closed

  /* ---------------- file actions ---------------- */

  function handleNewPattern() {
    if (shapes.length && !window.confirm('현재 캔버스를 비웁니다. 저장하지 않은 작업은 사라집니다. 계속할까요?')) return
    setShapes([])
    setSelectedId(null)
  }

  function handleExportSvg() {
    if (!canSave) return
    const svg = buildSvgString(shapes, sheet.w, sheet.h)
    downloadBlob(`furboaee-pattern-${Date.now()}.svg`, new Blob([svg], { type: 'image/svg+xml' }))
  }

  function handleExportPng() {
    const svg = buildSvgString(shapes, sheet.w, sheet.h)
    const blob = new Blob([svg], { type: 'image/svg+xml' })
    const url = URL.createObjectURL(blob)
    const img = new Image()
    img.onload = () => {
      const PX_PER_MM = 150 / 25.4
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
    if (!canSave) return
    setSaveName(`패턴 ${new Date().toLocaleDateString('ko-KR')}`)
    setShowSaveModal(true)
  }

  function confirmSave() {
    if (!canSave) return
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
          <button
            className="btn btn-gold"
            onClick={openSaveModal}
            disabled={!canSave}
            title={!canSave ? '모든 선/곡선의 끝점이 폐곡선을 이루어야 저장할 수 있습니다' : ''}
          >
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
            <span>
              {closureStatus.closed ? (
                <strong style={{ color: '#8fbf6c' }}>폐곡선 완성 ✓</strong>
              ) : shapes.length ? (
                <strong style={{ color: '#c1443c' }}>열린 점 {closureStatus.openPoints.length}개 — 이어서 그려야 저장 가능</strong>
              ) : (
                '폐곡선을 그리면 저장할 수 있습니다'
              )}
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
                closureStatus={closureStatus}
              />
            ) : (
              <LibraryPanel savedPatterns={savedPatterns} onLoad={loadPattern} onDelete={deleteSavedPattern} />
            )}
          </div>
        </aside>
      </div>

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
