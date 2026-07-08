import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import PropertiesPanel from '../PropertiesPanel.jsx'

const baseProps = {
  sheetKey: 'block',
  onSheetChange: vi.fn(),
  shapes: [],
  selectedShape: null,
  selectedId: null,
  onSelect: vi.fn(),
  onDelete: vi.fn(),
  onLengthChange: vi.fn(),
  closureStatus: { closed: false, openPoints: [] },
}

describe('PropertiesPanel', () => {
  it('shows "저장할 수 있습니다" when closed', () => {
    render(<PropertiesPanel {...baseProps} closureStatus={{ closed: true, openPoints: [] }} />)
    expect(screen.getByText(/저장할 수 있습니다/)).toBeInTheDocument()
  })

  it('shows open points count when not closed', () => {
    render(<PropertiesPanel {...baseProps} closureStatus={{ closed: false, openPoints: [{}, {}] }} />)
    expect(screen.getByText('2개')).toBeInTheDocument()
  })

  it('shows empty hint when no shape selected', () => {
    render(<PropertiesPanel {...baseProps} />)
    expect(screen.getByText(/캔버스에서 직선 또는 곡선을 클릭해 선택하세요/)).toBeInTheDocument()
  })

  it('shows length input for a selected line', () => {
    const line = { id: 'l1', type: 'line', x1: 0, y1: 0, x2: 100, y2: 0 }
    render(<PropertiesPanel {...baseProps} selectedShape={line} selectedId="l1" shapes={[line]} />)
    expect(screen.getByText('길이 (cm)')).toBeInTheDocument()
    expect(screen.getByDisplayValue('10.0')).toBeInTheDocument()
  })

  it('shows curve length for a selected curve', () => {
    const curve = { id: 'c1', type: 'curve', x1: 0, y1: 0, c1x: 33, c1y: 0, c2x: 66, c2y: 0, x2: 100, y2: 0 }
    render(<PropertiesPanel {...baseProps} selectedShape={curve} selectedId="c1" shapes={[curve]} />)
    expect(screen.getByText('대략 길이 (cm)')).toBeInTheDocument()
  })

  it('calls onDelete when delete button is clicked', async () => {
    const onDelete = vi.fn()
    const line = { id: 'l1', type: 'line', x1: 0, y1: 0, x2: 100, y2: 0 }
    render(<PropertiesPanel {...baseProps} selectedShape={line} selectedId="l1" shapes={[line]} onDelete={onDelete} />)
    await userEvent.click(screen.getByText('이 요소 삭제'))
    expect(onDelete).toHaveBeenCalledWith('l1')
  })

  it('renders the shape list', () => {
    const shapes = [
      { id: 'l1', type: 'line', x1: 0, y1: 0, x2: 100, y2: 0 },
      { id: 'c1', type: 'curve', x1: 0, y1: 0, c1x: 30, c1y: 20, c2x: 70, c2y: 20, x2: 100, y2: 0 },
    ]
    render(<PropertiesPanel {...baseProps} shapes={shapes} />)
    expect(screen.getByText(/전체 요소 \(2\)/)).toBeInTheDocument()
  })
})
