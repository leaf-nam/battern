export default function LibraryPanel({ savedPatterns, onLoad, onDelete }) {
  if (!savedPatterns.length) {
    return <p className="empty-hint">아직 저장된 패턴이 없습니다. 상단의 "보관함에 저장" 버튼으로 현재 작업을 저장하세요.</p>
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
