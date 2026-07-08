export default function Handle({ x, y, gold, onDown }) {
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
