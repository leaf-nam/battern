import { INK, STROKE_MM } from '../constants.js'

function shapeToSvgEl(s) {
  if (s.type === 'line') {
    return `<line x1="${s.x1.toFixed(2)}" y1="${s.y1.toFixed(2)}" x2="${s.x2.toFixed(2)}" y2="${s.y2.toFixed(2)}" stroke="${INK}" stroke-width="${STROKE_MM}" stroke-linecap="round"/>`
  }
  return `<path d="M ${s.x1.toFixed(2)},${s.y1.toFixed(2)} C ${s.c1x.toFixed(2)},${s.c1y.toFixed(2)} ${s.c2x.toFixed(2)},${s.c2y.toFixed(2)} ${s.x2.toFixed(2)},${s.y2.toFixed(2)}" fill="none" stroke="${INK}" stroke-width="${STROKE_MM}" stroke-linecap="round"/>`
}

export function buildSvgString(shapes, wMm, hMm, backgroundImage) {
  const extra = []
  if (backgroundImage) {
    extra.push(`  <image x="0" y="0" width="${wMm}" height="${hMm}" preserveAspectRatio="xMidYMid slice" href="${backgroundImage}"/>`)
  }
  const body = shapes.map(shapeToSvgEl).join('\n  ')
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${wMm} ${hMm}" width="${(wMm / 10).toFixed(2)}cm" height="${(hMm / 10).toFixed(2)}cm">
  <rect x="0" y="0" width="${wMm}" height="${hMm}" fill="#ffffff"/>
${extra.join('\n')}  ${body}
</svg>`
}

export function downloadBlob(filename, blob) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}
