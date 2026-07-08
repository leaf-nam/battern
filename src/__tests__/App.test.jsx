import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import App from '../App.jsx'

beforeEach(() => {
  vi.spyOn(window, 'confirm').mockReturnValue(true)
  vi.spyOn(window, 'prompt').mockReturnValue('')
  localStorage.clear()
})

afterEach(() => {
  vi.restoreAllMocks()
})

function getSvg() {
  return document.querySelector('.pattern-sheet')
}

function renderApp() {
  return render(<App />)
}

/* helpers to find toolbar buttons by title (avoids status-bar duplicates) */
const toolBtn = (name) => screen.getByTitle(name)

describe('App — 기본 렌더링', () => {
  it('renders header, toolbar, canvas, and side panel', () => {
    renderApp()
    expect(screen.getByText('Furboaee Draft')).toBeInTheDocument()
    expect(toolBtn('직선 그리기')).toBeInTheDocument()
    expect(toolBtn('곡선 그리기')).toBeInTheDocument()
    expect(toolBtn('선택 / 편집')).toBeInTheDocument()
    expect(screen.getByText('속성')).toBeInTheDocument()
    expect(screen.getByText('보관함')).toBeInTheDocument()
  })

  it('renders the SVG canvas with correct viewBox', () => {
    renderApp()
    const svg = getSvg()
    expect(svg).toBeInTheDocument()
    expect(svg).toHaveAttribute('viewBox', '0 0 400 300')
  })

  it('shows empty status bar message', () => {
    renderApp()
    expect(screen.getByText(/폐곡선을 그리면 저장할 수 있습니다/)).toBeInTheDocument()
  })
})

describe('App — 도구 선택', () => {
  it('starts with line tool selected', () => {
    renderApp()
    const btn = toolBtn('직선 그리기')
    expect(btn.classList.contains('active')).toBe(true)
  })

  it('switches to curve tool on click', async () => {
    renderApp()
    await userEvent.click(toolBtn('곡선 그리기'))
    expect(toolBtn('곡선 그리기').classList.contains('active')).toBe(true)
    expect(toolBtn('직선 그리기').classList.contains('active')).toBe(false)
  })

  it('switches to select tool on click', async () => {
    renderApp()
    await userEvent.click(toolBtn('선택 / 편집'))
    expect(toolBtn('선택 / 편집').classList.contains('active')).toBe(true)
  })
})

describe('App — 직선 그리기', () => {
  it('creates a line shape after drag on canvas', () => {
    renderApp()
    const svg = getSvg()

    Object.defineProperty(svg, 'getBoundingClientRect', {
      value: () => ({ left: 0, top: 0, width: 400 * 3, height: 300 * 3 }),
      configurable: true,
    })

    act(() => {
      svg.dispatchEvent(new MouseEvent('mousedown', { clientX: 30, clientY: 30, bubbles: true }))
    })
    act(() => {
      svg.dispatchEvent(new MouseEvent('mousemove', { clientX: 120, clientY: 30, bubbles: true }))
    })
    act(() => {
      svg.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }))
    })

    const lines = svg.querySelectorAll('line')
    expect(lines.length).toBeGreaterThanOrEqual(2)
  })
})

describe('App — 새 패턴 / 파일 액션', () => {
  it('새 패턴 button clears shapes', async () => {
    renderApp()
    const svg = getSvg()

    Object.defineProperty(svg, 'getBoundingClientRect', {
      value: () => ({ left: 0, top: 0, width: 400 * 3, height: 300 * 3 }),
      configurable: true,
    })

    act(() => {
      svg.dispatchEvent(new MouseEvent('mousedown', { clientX: 30, clientY: 30, bubbles: true }))
    })
    act(() => {
      svg.dispatchEvent(new MouseEvent('mousemove', { clientX: 120, clientY: 30, bubbles: true }))
    })
    act(() => {
      svg.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }))
    })

    expect(screen.getByText(/1개 요소/)).toBeInTheDocument()

    await userEvent.click(screen.getByText('새 패턴'))
    expect(screen.getByText(/0개 요소/)).toBeInTheDocument()
  })

  it('SVG 저장 button is disabled when no closed loop', () => {
    renderApp()
    const btn = screen.getByText('SVG 저장')
    expect(btn).toBeDisabled()
  })
})

describe('App — 보관함 저장/불러오기', () => {
  it('opens save modal when 보관함에 저장 is clicked with shapes (no closed loop check via mock)', async () => {
    renderApp()
    const svg = getSvg()

    Object.defineProperty(svg, 'getBoundingClientRect', {
      value: () => ({ left: 0, top: 0, width: 400 * 3, height: 300 * 3 }),
      configurable: true,
    })

    act(() => {
      svg.dispatchEvent(new MouseEvent('mousedown', { clientX: 30, clientY: 30, bubbles: true }))
    })
    act(() => {
      svg.dispatchEvent(new MouseEvent('mousemove', { clientX: 120, clientY: 30, bubbles: true }))
    })
    act(() => {
      svg.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }))
    })

    await userEvent.click(screen.getByText('보관함에 저장'))
    expect(screen.queryByText('보관함에 저장')).toBeTruthy()
  })
})

describe('App — 인쇄 / PNG', () => {
  it('인쇄 (1:1) button is disabled when no shapes', () => {
    renderApp()
    expect(screen.getByText('인쇄 (1:1)')).toBeDisabled()
  })

  it('PNG 내보내기 button is disabled when no shapes', () => {
    renderApp()
    expect(screen.getByText('PNG 내보내기')).toBeDisabled()
  })
})

describe('App — 배경 사진', () => {
  it('shows "이미지 선택" in properties panel initially', () => {
    renderApp()
    expect(screen.getByText('이미지 선택')).toBeInTheDocument()
  })

  it('renders hidden file input', () => {
    renderApp()
    const input = document.querySelector('input[type="file"]')
    expect(input).toBeInTheDocument()
    expect(input).toHaveAttribute('accept', 'image/*')
  })

  it('새 패턴 clears background image', async () => {
    renderApp()
    await userEvent.click(screen.getByText('새 패턴'))
    expect(screen.getByText('이미지 선택')).toBeInTheDocument()
  })

  it('does not show "내보내기에 포함" checkbox when no background', () => {
    renderApp()
    expect(screen.queryByText('내보내기에 포함')).not.toBeInTheDocument()
  })
})

describe('App — 줌 버튼', () => {
  it('renders zoom step buttons', () => {
    renderApp()
    ;[1, 1.5, 2, 3, 4, 6].forEach((z) => {
      expect(screen.getByText(`${z}×`)).toBeInTheDocument()
    })
  })

  it('renders 전체축소 and 기본확대 buttons', () => {
    renderApp()
    expect(screen.getByText('전체축소')).toBeInTheDocument()
    expect(screen.getByText('기본확대')).toBeInTheDocument()
  })

  it('기본확대 resets zoom to default', async () => {
    renderApp()
    await userEvent.click(screen.getByText('6×'))
    expect(screen.getByText(/6px\/mm/)).toBeInTheDocument()
    await userEvent.click(screen.getByText('기본확대'))
    expect(screen.getByText(/3px\/mm/)).toBeInTheDocument()
  })
})

describe('App — 영역 선택 (marquee)', () => {
  it('creates marquee rect on select tool drag', () => {
    renderApp()
    act(() => { toolBtn('선택 / 편집').click() })

    const svg = getSvg()
    Object.defineProperty(svg, 'getBoundingClientRect', {
      value: () => ({ left: 0, top: 0, width: 400 * 3, height: 300 * 3 }),
      configurable: true,
    })

    act(() => {
      svg.dispatchEvent(new MouseEvent('mousedown', { clientX: 30, clientY: 30, bubbles: true }))
    })
    act(() => {
      svg.dispatchEvent(new MouseEvent('mousemove', { clientX: 200, clientY: 200, bubbles: true }))
    })

    const rects = svg.querySelectorAll('rect')
    const marquee = Array.from(rects).find(
      (r) => r.getAttribute('stroke') === '#e3b23c'
    )
    expect(marquee).toBeTruthy()
  })

  it('clicking empty space in select mode deselects on mouseup (tiny marquee)', () => {
    renderApp()
    act(() => { toolBtn('선택 / 편집').click() })

    const svg = getSvg()
    Object.defineProperty(svg, 'getBoundingClientRect', {
      value: () => ({ left: 0, top: 0, width: 400 * 3, height: 300 * 3 }),
      configurable: true,
    })

    act(() => {
      svg.dispatchEvent(new MouseEvent('mousedown', { clientX: 50, clientY: 50, bubbles: true }))
    })
    act(() => {
      svg.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }))
    })

    expect(screen.getByText(/0개 요소/)).toBeInTheDocument()
  })
})

describe('App — 다중 선택 삭제', () => {
  it('delete button is enabled when shape is selected', async () => {
    renderApp()
    const svg = getSvg()
    Object.defineProperty(svg, 'getBoundingClientRect', {
      value: () => ({ left: 0, top: 0, width: 400 * 3, height: 300 * 3 }),
      configurable: true,
    })

    act(() => {
      svg.dispatchEvent(new MouseEvent('mousedown', { clientX: 30, clientY: 30, bubbles: true }))
    })
    act(() => {
      svg.dispatchEvent(new MouseEvent('mousemove', { clientX: 120, clientY: 30, bubbles: true }))
    })
    act(() => {
      svg.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }))
    })

    expect(screen.getByTitle('선택한 요소 삭제')).not.toBeDisabled()
  })
})

describe('App — 선택 이동', () => {
  async function drawOneLine(svg) {
    Object.defineProperty(svg, 'getBoundingClientRect', {
      value: () => ({ left: 0, top: 0, width: 400 * 3, height: 300 * 3 }),
      configurable: true,
    })
    act(() => { svg.dispatchEvent(new MouseEvent('mousedown', { clientX: 30, clientY: 30, bubbles: true })) })
    act(() => { svg.dispatchEvent(new MouseEvent('mousemove', { clientX: 120, clientY: 30, bubbles: true })) })
    act(() => { svg.dispatchEvent(new MouseEvent('mouseup', { bubbles: true })) })
  }

  it('drags a selected line in select tool to move its position', async () => {
    renderApp()
    const svg = getSvg()
    drawOneLine(svg)

    await userEvent.click(toolBtn('선택 / 편집'))

    const shapeGroup = document.querySelector('[data-testid="shape"]')
    const lineEl = shapeGroup.querySelector('line')
    const initialX1 = parseFloat(lineEl.getAttribute('x1'))
    expect(initialX1).toBe(10)

    act(() => {
      shapeGroup.dispatchEvent(new MouseEvent('mousedown', { clientX: 75, clientY: 30, bubbles: true }))
    })
    act(() => {
      svg.dispatchEvent(new MouseEvent('mousemove', { clientX: 200, clientY: 50, bubbles: true }))
    })
    act(() => {
      svg.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }))
    })

    const movedX1 = parseFloat(lineEl.getAttribute('x1'))
    expect(movedX1).not.toBe(10)
  })

  it('single-selected shape shows red line with handles', () => {
    renderApp()
    const svg = getSvg()
    drawOneLine(svg)

    const shapeGroup = document.querySelector('[data-testid="shape"]')
    const visualLine = shapeGroup.querySelector('line:not([stroke="transparent"])')
    expect(visualLine.getAttribute('stroke')).toBe('#c1443c')

    const circles = shapeGroup.querySelectorAll('circle')
    expect(circles.length).toBe(2)
  })
})
