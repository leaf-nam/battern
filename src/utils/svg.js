import { INK, STROKE_MM } from '../constants.js'

function shapeToSvgEl(s) {
  if (s.type === 'line') {
    return `<line x1="${s.x1.toFixed(2)}" y1="${s.y1.toFixed(2)}" x2="${s.x2.toFixed(2)}" y2="${s.y2.toFixed(2)}" stroke="${INK}" stroke-width="${STROKE_MM}" stroke-linecap="round"/>`
  }
  return `<path d="M ${s.x1.toFixed(2)},${s.y1.toFixed(2)} C ${s.c1x.toFixed(2)},${s.c1y.toFixed(2)} ${s.c2x.toFixed(2)},${s.c2y.toFixed(2)} ${s.x2.toFixed(2)},${s.y2.toFixed(2)}" fill="none" stroke="${INK}" stroke-width="${STROKE_MM}" stroke-linecap="round"/>`
}

export function buildSvgString(shapes, wMm, hMm, backgroundImage, transparentBg) {
  const extra = []
  if (backgroundImage) {
    extra.push(`  <image x="0" y="0" width="${wMm}" height="${hMm}" preserveAspectRatio="xMidYMid slice" href="${backgroundImage}"/>`)
  }
  const body = shapes.map(shapeToSvgEl).join('\n  ')
  const bgRect = transparentBg ? '' : `  <rect x="0" y="0" width="${wMm}" height="${hMm}" fill="#ffffff"/>\n`
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${wMm} ${hMm}" width="${(wMm / 10).toFixed(2)}cm" height="${(hMm / 10).toFixed(2)}cm">
${bgRect}${extra.join('\n')}  ${body}
</svg>`
}

export function buildTiledPrintHtml(shapes, wMm, hMm, backgroundImage) {
  const TILE_W = 210
  const TILE_H = 297

  const tilesX = Math.ceil(wMm / TILE_W)
  const tilesY = Math.ceil(hMm / TILE_H)

  const allShapesEl = shapes.map(shapeToSvgEl).join('\n          ')

  let pagesHtml = ''
  let pageNum = 0
  const totalPages = tilesX * tilesY

  for (let ty = 0; ty < tilesY; ty++) {
    for (let tx = 0; tx < tilesX; tx++) {
      pageNum++
      const vx = tx * TILE_W
      const vy = ty * TILE_H
      const tw = Math.min(TILE_W, wMm - vx)
      const th = Math.min(TILE_H, hMm - vy)
      const clipId = `clip-${tx}-${ty}`

      let bgEl = ''
      if (backgroundImage) {
        bgEl = `\n            <image x="0" y="0" width="${wMm}" height="${hMm}" preserveAspectRatio="xMidYMid slice" href="${backgroundImage}" opacity="0.6"/>`
      }

      const marks = [
        '<g stroke="#999" stroke-width="0.3">',
        `<line x1="${tw / 2 - 3}" y1="0" x2="${tw / 2 + 3}" y2="0"/>`,
        `<line x1="${tw / 2}" y1="0" x2="${tw / 2}" y2="3"/>`,
        `<line x1="${tw / 2 - 3}" y1="${th}" x2="${tw / 2 + 3}" y2="${th}"/>`,
        `<line x1="${tw / 2}" y1="${th - 3}" x2="${tw / 2}" y2="${th}"/>`,
        `<line x1="0" y1="${th / 2 - 3}" x2="0" y2="${th / 2 + 3}"/>`,
        `<line x1="0" y1="${th / 2}" x2="3" y2="${th / 2}"/>`,
        `<line x1="${tw}" y1="${th / 2 - 3}" x2="${tw}" y2="${th / 2 + 3}"/>`,
        `<line x1="${tw - 3}" y1="${th / 2}" x2="${tw}" y2="${th / 2}"/>`,
        '</g>',
      ]
      const marksEl = marks.join('\n            ')

      pagesHtml += `
      <div class="page">
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="${vx} ${vy} ${tw} ${th}" width="${tw}mm" height="${th}mm">
          <defs>
            <clipPath id="${clipId}">
              <rect x="0" y="0" width="${tw}" height="${th}"/>
            </clipPath>
          </defs>
          <g clip-path="url(#${clipId})">
            <rect x="0" y="0" width="${wMm}" height="${hMm}" fill="#ffffff"/>${bgEl}
            ${allShapesEl}
          </g>
          <rect x="0" y="0" width="${tw}" height="${th}" fill="none" stroke="#ccc" stroke-width="0.2" stroke-dasharray="2 2"/>
          ${marksEl}
          <text x="${tw - 3}" y="${th - 3}" font-family="sans-serif" font-size="3" fill="#999" text-anchor="end">${pageNum} / ${totalPages}</text>
        </svg>
      </div>`
    }
  }

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<style>
  @page { size: A4; margin: 0; }
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { display: flex; flex-direction: column; align-items: center; }
  .page {
    width: 210mm;
    height: 297mm;
    display: flex;
    align-items: center;
    justify-content: center;
    page-break-after: always;
  }
  .page:last-child { page-break-after: auto; }
  svg { display: block; }
</style>
</head>
<body>
${pagesHtml}
</body>
</html>`
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
