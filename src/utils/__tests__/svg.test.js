import { describe, it, expect } from 'vitest'
import { buildSvgString, buildTiledPrintHtml } from '../svg.js'

describe('buildSvgString', () => {
  it('produces an SVG string with correct dimensions', () => {
    const shapes = []
    const svg = buildSvgString(shapes, 400, 300)
    expect(svg).toContain('viewBox="0 0 400 300"')
    expect(svg).toContain('width="40.00cm"')
    expect(svg).toContain('height="30.00cm"')
    expect(svg).toContain('<svg xmlns')
    expect(svg).toContain('</svg>')
  })

  it('includes shapes as SVG elements', () => {
    const shapes = [
      { type: 'line', x1: 0, y1: 0, x2: 100, y2: 0 },
    ]
    const svg = buildSvgString(shapes, 400, 300)
    expect(svg).toContain('<line')
    expect(svg).toContain('x1="0.00"')
    expect(svg).toContain('x2="100.00"')
  })

  it('includes curve path data for curve shapes', () => {
    const shapes = [
      { type: 'curve', x1: 0, y1: 0, c1x: 30, c1y: 20, c2x: 70, c2y: 20, x2: 100, y2: 0 },
    ]
    const svg = buildSvgString(shapes, 400, 300)
    expect(svg).toContain('<path')
    expect(svg).toContain('C ')
  })

  it('includes background image when provided', () => {
    const shapes = []
    const svg = buildSvgString(shapes, 400, 300, 'data:image/png;base64,abc123')
    expect(svg).toContain('<image')
    expect(svg).toContain('href="data:image/png;base64,abc123"')
    expect(svg).toContain('preserveAspectRatio="xMidYMid slice"')
  })

  it('does not include image element when no background', () => {
    const shapes = []
    const svg = buildSvgString(shapes, 400, 300)
    expect(svg).not.toContain('<image')
  })
})

describe('buildTiledPrintHtml', () => {
  it('returns a complete HTML document', () => {
    const html = buildTiledPrintHtml([], 400, 300)
    expect(html).toContain('<!DOCTYPE html>')
    expect(html).toContain('</html>')
    expect(html).toContain('@page { size: A4;')
  })

  it('produces correct number of tile pages', () => {
    // 400×300mm sheet → 2 tiles wide (ceil(400/210)), 2 tiles tall (ceil(300/297)) = 4 pages
    const html = buildTiledPrintHtml([], 400, 300)
    const matches = html.match(/class="page"/g)
    expect(matches).toHaveLength(4)
  })

  it('includes shapes in tiles', () => {
    const shapes = [{ type: 'line', x1: 10, y1: 10, x2: 100, y2: 10 }]
    const html = buildTiledPrintHtml(shapes, 210, 297)
    expect(html).toContain('<line')
    expect(html).toContain('x1="10.00"')
  })

  it('includes background image when provided', () => {
    const html = buildTiledPrintHtml([], 400, 300, 'data:image/png;base64,abc')
    expect(html).toContain('href="data:image/png;base64,abc"')
  })

  it('handles A4-size sheet as a single tile', () => {
    const html = buildTiledPrintHtml([], 210, 297)
    const matches = html.match(/class="page"/g)
    expect(matches).toHaveLength(1)
  })
})
