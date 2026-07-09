import { SHEET_PRESETS } from '../constants.js'
import { curveLengthMm } from '../utils/geometry.js'

export default function PropertiesPanel({ sheetKey, onSheetChange, shapes, selectedShape, selectedId, multiCount, selectionBounds, onSelect, onDelete, onLengthChange, onResizeBounds, closureStatus, backgroundImage, onBackgroundUpload, onBackgroundRemove, includeBgExport, onToggleBgExport, transparentBgExport, onToggleTransparentBg }) {
  const resizeW = selectionBounds ? (selectionBounds.w / 10).toFixed(1) : ''
  const resizeH = selectionBounds ? (selectionBounds.h / 10).toFixed(1) : ''
  const lineLen = selectedShape?.type === 'line'
    ? (Math.hypot(selectedShape.x2 - selectedShape.x1, selectedShape.y2 - selectedShape.y1) / 10).toFixed(2)
    : ''

  return (
    <>
      {multiCount > 0 && (
        <div className="field" style={{ padding: '10px 12px', borderRadius: 3, border: '1px solid var(--charcoal-3)', background: 'var(--charcoal-2)', fontSize: 12, lineHeight: 1.6, marginBottom: 16 }}>
          <strong style={{ color: '#4a9eff' }}>{multiCount}개 요소 선택됨</strong> — Delete 키로 일괄 삭제할 수 있습니다.
        </div>
      )}
      {selectionBounds && (
        <>
          <p className="panel-section-title">크기 조절</p>
          <div className="field-row" style={{ gap: 6 }}>
            <div className="field" style={{ flex: 1 }}>
              <label>폭 (cm)</label>
              <input
                key={'w-' + (selectionBounds ? `${selectionBounds.x}-${selectionBounds.y}-${selectionBounds.w}-${selectionBounds.h}` : 'none')}
                type="number"
                step="0.1"
                min="0.1"
                defaultValue={resizeW}
                onBlur={(e) => {
                  const v = parseFloat(e.target.value)
                  if (v > 0) onResizeBounds(v * 10, selectionBounds.h)
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.target.blur()
                  }
                }}
              />
            </div>
            <div className="field" style={{ flex: 1 }}>
              <label>높이 (cm)</label>
              <input
                key={'h-' + (selectionBounds ? `${selectionBounds.x}-${selectionBounds.y}-${selectionBounds.w}-${selectionBounds.h}` : 'none')}
                type="number"
                step="0.1"
                min="0.1"
                defaultValue={resizeH}
                onBlur={(e) => {
                  const v = parseFloat(e.target.value)
                  if (v > 0) onResizeBounds(selectionBounds.w, v * 10)
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.target.blur()
                  }
                }}
              />
            </div>
          </div>
        </>
      )}

      <p className="panel-section-title">저장 조건</p>
      <div
        className="field"
        style={{
          padding: '10px 12px',
          borderRadius: 3,
          border: `1px solid ${closureStatus.closed ? '#3c5c33' : 'var(--charcoal-3)'}`,
          background: closureStatus.closed ? 'rgba(143,191,108,0.08)' : 'var(--charcoal-2)',
          fontSize: 12,
          lineHeight: 1.6,
        }}
      >
        {closureStatus.closed ? (
          <span style={{ color: '#8fbf6c' }}>모든 점이 폐곡선을 이루고 있어요. 저장할 수 있습니다.</span>
        ) : (
          <span style={{ color: 'var(--muted)' }}>
            모든 선/곡선의 끝점은 다른 하나의 끝점과 정확히 맞닿아야 저장할 수 있습니다. 끝점을 다른 끝점 근처(약 0.6cm 이내)로 그리거나 드래그하면 자동으로 붙습니다.
            {closureStatus.openPoints.length > 0 && <> 현재 열린 점 <strong style={{ color: '#c1443c' }}>{closureStatus.openPoints.length}개</strong>가 남아 있어요.</>}
          </span>
        )}
      </div>

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

      <p className="panel-section-title" style={{ marginTop: 20 }}>배경 사진</p>
      <div className="field">
        {backgroundImage ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div
              style={{
                width: '100%',
                height: 80,
                borderRadius: 3,
                backgroundImage: `url(${backgroundImage})`,
                backgroundSize: 'cover',
                backgroundPosition: 'center',
                border: '1px solid var(--charcoal-3)',
              }}
            />
            <button className="btn btn-danger" onClick={onBackgroundRemove} style={{ fontSize: 11, padding: '5px 9px' }}>
              배경 제거
            </button>
          </div>
        ) : (
          <button className="btn" onClick={onBackgroundUpload} style={{ width: '100%' }}>
            이미지 선택
          </button>
        )}
        {backgroundImage && (
          <label
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              fontSize: 12,
              color: 'var(--muted)',
              cursor: 'pointer',
              marginTop: 4,
              marginBottom: 8,
            }}
          >
            <input
              type="checkbox"
              checked={includeBgExport}
              onChange={onToggleBgExport}
              style={{ accentColor: 'var(--gold)' }}
            />
            내보내기에 포함
          </label>
        )}
        <p className="empty-hint" style={{ marginTop: backgroundImage ? 0 : 6, marginBottom: 0, fontSize: 11 }}>
          선택한 이미지가 캔버스 배경으로 표시됩니다. SVG/PNG 내보내기에 포함됩니다.
        </p>
        <label
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            fontSize: 12,
            color: 'var(--muted)',
            cursor: 'pointer',
            marginTop: 4,
            marginBottom: 8,
          }}
        >
          <input
            type="checkbox"
            checked={transparentBgExport}
            onChange={onToggleTransparentBg}
            style={{ accentColor: 'var(--gold)' }}
          />
          투명 배경 (PNG)
        </label>
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
              key={'len-' + (selectedShape?.id ?? 'none')}
              type="number"
              step="0.01"
              min="0.1"
              defaultValue={lineLen}
              onBlur={(e) => {
                const v = parseFloat(e.target.value)
                if (v > 0 && selectedShape) onLengthChange(selectedShape.id, v)
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') e.target.blur()
              }}
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
