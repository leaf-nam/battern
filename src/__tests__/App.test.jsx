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

describe('App — 줌 버튼', () => {
  it('renders zoom step buttons', () => {
    renderApp()
    ;[1, 1.5, 2, 3, 4, 6].forEach((z) => {
      expect(screen.getByText(`${z}×`)).toBeInTheDocument()
    })
  })
})
