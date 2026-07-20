import { SHEET_PRESETS } from "../constants.js";
import { dist, curveLengthMm } from "../utils/geometry.js";

export default function PropertiesPanel({
  sheetKey,
  onSheetChange,
  customW,
  customH,
  onCustomSheetChange,
  minSheetMm,
  maxSheetMm,
  shapes,
  selectedShape,
  selectedId,
  multiCount,
  selectionBounds,
  onSelect,
  onDelete,
  onLengthChange,
  onResizeBounds,
  closureStatus,
  backgroundImage,
  onBackgroundUpload,
  onBackgroundRemove,
  includeBgExport,
  onToggleBgExport,
  transparentBgExport,
  onToggleTransparentBg,
  seamEnabled,
  onToggleSeam,
  seamWidth,
  onSeamWidthChange,
  filletCurvature,
  onFilletCurvatureChange,
  canApplyFillet,
  onApplyFillet,
  onArcRadiusChange,
}) {
  const resizeW = selectionBounds ? (selectionBounds.w / 10).toFixed(1) : "";
  const resizeH = selectionBounds ? (selectionBounds.h / 10).toFixed(1) : "";
  const lineLen =
    selectedShape?.type === "line"
      ? (
          Math.hypot(
            selectedShape.x2 - selectedShape.x1,
            selectedShape.y2 - selectedShape.y1,
          ) / 10
        ).toFixed(2)
      : "";

  return (
    <>
      {multiCount > 0 && (
        <div
          className="field"
          style={{
            padding: "10px 12px",
            borderRadius: 3,
            border: "1px solid var(--charcoal-3)",
            background: "var(--charcoal-2)",
            fontSize: 12,
            lineHeight: 1.6,
            marginBottom: 16,
          }}
        >
          <strong style={{ color: "#4a9eff" }}>
            {multiCount}개 요소 선택됨
          </strong>{" "}
          — Delete 키로 일괄 삭제할 수 있습니다.
        </div>
      )}

      {multiCount > 0 && (
        <>
          <p className="panel-section-title">필렛</p>
          <div className="field">
            <label>곡률: {filletCurvature}%</label>
            <input
              type="range"
              min="0"
              max="100"
              value={filletCurvature}
              onChange={(e) => onFilletCurvatureChange(parseInt(e.target.value))}
              style={{ width: "100%" }}
            />
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "var(--muted)", marginTop: 2 }}>
              <span>직선 (0%)</span>
              <span>원형 (100%)</span>
            </div>
          </div>
          <button
            className="btn"
            onClick={onApplyFillet}
            disabled={!canApplyFillet}
            style={{ width: "100%", marginTop: 6 }}
            title={canApplyFillet ? '' : '끝점을 공유하는 2개 이상의 요소를 선택해야 합니다'}
          >
            필렛 적용
          </button>
        </>
      )}
      {selectionBounds && (
        <>
          <p className="panel-section-title">크기 조절</p>
          <div className="field-row" style={{ gap: 6 }}>
            <div className="field" style={{ flex: 1 }}>
              <label>폭 (cm)</label>
              <input
                key={
                  "w-" +
                  (selectionBounds
                    ? `${selectionBounds.x}-${selectionBounds.y}-${selectionBounds.w}-${selectionBounds.h}`
                    : "none")
                }
                type="number"
                step="0.1"
                min="0.1"
                defaultValue={resizeW}
                onBlur={(e) => {
                  const v = parseFloat(e.target.value);
                  if (v > 0) onResizeBounds(v * 10, selectionBounds.h);
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.target.blur();
                  }
                }}
              />
            </div>
            <div className="field" style={{ flex: 1 }}>
              <label>높이 (cm)</label>
              <input
                key={
                  "h-" +
                  (selectionBounds
                    ? `${selectionBounds.x}-${selectionBounds.y}-${selectionBounds.w}-${selectionBounds.h}`
                    : "none")
                }
                type="number"
                step="0.1"
                min="0.1"
                defaultValue={resizeH}
                onBlur={(e) => {
                  const v = parseFloat(e.target.value);
                  if (v > 0) onResizeBounds(selectionBounds.w, v * 10);
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.target.blur();
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
          padding: "10px 12px",
          borderRadius: 3,
          border: `1px solid ${closureStatus.closed ? "#3c5c33" : "var(--charcoal-3)"}`,
          background: closureStatus.closed
            ? "rgba(143,191,108,0.08)"
            : "var(--charcoal-2)",
          fontSize: 12,
          lineHeight: 1.6,
        }}
      >
        {closureStatus.closed ? (
          <span style={{ color: "#8fbf6c" }}>
            모든 점이 폐곡선을 이루고 있어요. 저장할 수 있습니다.
          </span>
        ) : (
          <span style={{ color: "var(--muted)" }}>
            모든 선/곡선의 끝점은 다른 하나의 끝점과 정확히 맞닿아야 저장할 수
            있습니다. 끝점을 다른 끝점 근처(약 0.6cm 이내)로 그리거나 드래그하면
            자동으로 붙습니다.
            {closureStatus.openPoints.length > 0 && (
              <>
                {" "}
                현재 열린 점{" "}
                <strong style={{ color: "#c1443c" }}>
                  {closureStatus.openPoints.length}개
                </strong>
                가 남아 있어요.
              </>
            )}
          </span>
        )}
      </div>

      <p className="panel-section-title">용지 크기</p>
      <div className="field">
        <select
          value={sheetKey}
          onChange={(e) => onSheetChange(e.target.value)}
          style={{
            width: "100%",
            padding: "8px 10px",
            background: "var(--charcoal-2)",
            border: "1px solid var(--charcoal-3)",
            color: "var(--paper)",
            borderRadius: 3,
            fontFamily: "var(--font-mono)",
            fontSize: 12.5,
          }}
        >
          {Object.entries(SHEET_PRESETS).map(([k, v]) => (
            <option key={k} value={k}>
              {v.label}
            </option>
          ))}
          <option value="custom">사용자 설정</option>
        </select>
      </div>
      {sheetKey === "custom" && (
        <div className="field-row" style={{ gap: 6, marginTop: 6 }}>
          <div className="field" style={{ flex: 1 }}>
            <label>폭 (mm)</label>
            <input
              key={`cw-${customW}`}
              type="number"
              step="10"
              min={minSheetMm}
              max={maxSheetMm}
              defaultValue={customW}
              onBlur={(e) => {
                const v = parseInt(e.target.value);
                if (v >= minSheetMm && v <= maxSheetMm)
                  onCustomSheetChange(v, customH);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") e.target.blur();
              }}
            />
          </div>
          <div className="field" style={{ flex: 1 }}>
            <label>높이 (mm)</label>
            <input
              key={`ch-${customH}`}
              type="number"
              step="10"
              min={minSheetMm}
              max={maxSheetMm}
              defaultValue={customH}
              onBlur={(e) => {
                const v = parseInt(e.target.value);
                if (v >= minSheetMm && v <= maxSheetMm)
                  onCustomSheetChange(customW, v);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") e.target.blur();
              }}
            />
          </div>
        </div>
      )}
      {sheetKey === "custom" && (
        <p
          style={{
            fontSize: 11,
            color: "var(--muted)",
            marginTop: 4,
            textAlign: "right",
          }}
        >
          {minSheetMm / 10}cm ~ {maxSheetMm / 100}m
        </p>
      )}

      <p className="panel-section-title" style={{ marginTop: 20 }}>
        배경 사진
      </p>
      <div className="field">
        {backgroundImage ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <div
              style={{
                width: "100%",
                height: 80,
                borderRadius: 3,
                backgroundImage: `url(${backgroundImage})`,
                backgroundSize: "cover",
                backgroundPosition: "center",
                border: "1px solid var(--charcoal-3)",
              }}
            />
            <button
              className="btn btn-danger"
              onClick={onBackgroundRemove}
              style={{ fontSize: 11, padding: "5px 9px" }}
            >
              배경 제거
            </button>
          </div>
        ) : (
          <button
            className="btn"
            onClick={onBackgroundUpload}
            style={{ width: "100%" }}
          >
            이미지 선택
          </button>
        )}
        {backgroundImage && (
          <label
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              fontSize: 12,
              color: "var(--muted)",
              cursor: "pointer",
              marginTop: 4,
              marginBottom: 8,
            }}
          >
            <input
              type="checkbox"
              checked={includeBgExport}
              onChange={onToggleBgExport}
              style={{ accentColor: "var(--gold)" }}
            />
            내보내기에 포함
          </label>
        )}
        <p
          className="empty-hint"
          style={{
            marginTop: backgroundImage ? 0 : 6,
            marginBottom: 0,
            fontSize: 11,
          }}
        >
          선택한 이미지가 캔버스 배경으로 표시됩니다. SVG/PNG 내보내기에
          포함됩니다.
        </p>
        <label
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            fontSize: 12,
            color: "var(--muted)",
            cursor: "pointer",
            marginTop: 4,
            marginBottom: 8,
          }}
        >
          <input
            type="checkbox"
            checked={transparentBgExport}
            onChange={onToggleTransparentBg}
            style={{ accentColor: "var(--gold)" }}
          />
          투명 배경 (PNG)
        </label>
      </div>

      <p className="panel-section-title" style={{ marginTop: 20 }}>
        선택한 요소
      </p>

      {!selectedShape && (
        <p className="empty-hint">
          캔버스에서 직선/곡선/호를 클릭해 선택하세요. 선택 도구가 켜져 있어야
          합니다.
        </p>
      )}

      {selectedShape && selectedShape.type === "line" && (
        <>
          <div className="field">
            <label>길이 (cm)</label>
            <input
              key={"len-" + (selectedShape?.id ?? "none")}
              type="number"
              step="0.01"
              min="0.1"
              defaultValue={lineLen}
              onBlur={(e) => {
                const v = parseFloat(e.target.value);
                if (v > 0 && selectedShape) onLengthChange(selectedShape.id, v);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") e.target.blur();
              }}
            />
          </div>
          <button
            className="btn btn-danger"
            onClick={() => onDelete(selectedShape.id)}
          >
            이 요소 삭제
          </button>
        </>
      )}

      {selectedShape && selectedShape.type === "curve" && (
        <>
          <div className="field">
            <label>대략 길이 (cm)</label>
            <input
              type="text"
              readOnly
              value={(curveLengthMm(selectedShape) / 10).toFixed(1)}
            />
          </div>
          <p className="empty-hint">
            금색 손잡이(조절점)를 드래그하면 곡률이 바뀝니다. 빨간 손잡이는
            끝점입니다.
          </p>
          <button
            className="btn btn-danger"
            onClick={() => onDelete(selectedShape.id)}
          >
            이 요소 삭제
          </button>
        </>
      )}

      {selectedShape && selectedShape.type === "arc" && (
        <>
          <div className="field">
            <label>반지름 (mm)</label>
            {(() => {
              const chord = dist(selectedShape.x1, selectedShape.y1, selectedShape.x2, selectedShape.y2)
              const minR = chord * 0.5 + 0.5
              const maxR = chord * 50
              return (
                <input
                  key={"r-" + selectedShape.id + "-" + selectedShape.r.toFixed(1)}
                  type="number"
                  step="0.1"
                  min={minR.toFixed(1)}
                  max={maxR.toFixed(1)}
                  defaultValue={selectedShape.r.toFixed(1)}
                  onBlur={(e) => {
                    const v = parseFloat(e.target.value);
                    if (!isNaN(v) && v >= minR && v <= maxR) onArcRadiusChange(selectedShape.id, v);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") e.target.blur();
                  }}
                />
              )
            })()}
          </div>
          <p className="empty-hint">
            끝점을 공유하는 두 선 사이의 원형 호입니다. 반지름(r) 값으로
            곡률이 결정됩니다.
          </p>
          <button
            className="btn btn-danger"
            onClick={() => onDelete(selectedShape.id)}
          >
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
              <li
                key={s.id}
                className={`shape-row ${s.id === selectedId ? "selected" : ""}`}
                onClick={() => onSelect(s.id)}
              >
                <span>
                  <span className="tag">
                    {s.type === "line" ? "직선" : s.type === "arc" ? "호" : "곡선"}
                  </span>
                  #{i + 1}
                </span>
                <span
                  style={{
                    fontFamily: "var(--font-mono)",
                    fontSize: 11,
                    color: "var(--muted)",
                  }}
                >
                  {((s.type === "line"
                    ? Math.hypot(s.x2 - s.x1, s.y2 - s.y1)
                    : s.type === "arc"
                      ? s.r * 2 * Math.asin(Math.min(1, dist(s.x1, s.y1, s.x2, s.y2) / (2 * s.r)))
                      : curveLengthMm(s)) /
                    10) |
                    0}
                  cm
                </span>
              </li>
            ))}
          </ul>
        </>
      )}

      <p className="panel-section-title" style={{ marginTop: 20 }}>시접</p>
      <div className="field">
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: 'var(--muted)', cursor: 'pointer' }}>
          <input
            type="checkbox"
            checked={seamEnabled}
            onChange={onToggleSeam}
            style={{ accentColor: 'var(--gold)' }}
          />
          시접 자동 생성
        </label>
      </div>
      {seamEnabled && (
        <div className="field">
          <label>시접 너비 (mm)</label>
          <input
            type="number"
            min="1"
            max="100"
            step="1"
            value={seamWidth}
            onChange={(e) => onSeamWidthChange(Math.max(1, Math.min(100, parseInt(e.target.value) || 10)))}
          />
        </div>
      )}

      <div className="roadmap-note">
        <strong>다음 버전 예정:</strong> 태블릿 펜 압력 인식,
        패턴 사진 AI 분석, 버전 관리
      </div>
    </>
  );
}
