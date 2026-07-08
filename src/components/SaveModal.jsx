export default function SaveModal({ saveName, onNameChange, onConfirm, onCancel }) {
  return (
    <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onCancel()}>
      <div className="modal">
        <h3>보관함에 저장</h3>
        <div className="field">
          <label>패턴 이름</label>
          <input
            type="text"
            value={saveName}
            autoFocus
            onChange={(e) => onNameChange(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && onConfirm()}
          />
        </div>
        <div className="modal-actions">
          <button className="btn" onClick={onCancel}>
            취소
          </button>
          <button className="btn btn-gold" onClick={onConfirm}>
            저장
          </button>
        </div>
      </div>
    </div>
  )
}
