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
  backgroundImage: null,
  onBackgroundUpload: vi.fn(),
  onBackgroundRemove: vi.fn(),
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

  describe('배경 사진', () => {
    it('shows "이미지 선택" button when no background', () => {
      render(<PropertiesPanel {...baseProps} />)
      expect(screen.getByText('이미지 선택')).toBeInTheDocument()
    })

    it('shows "배경 제거" button when background is set', () => {
      render(<PropertiesPanel {...baseProps} backgroundImage="data:image/png;base64,abc" />)
      expect(screen.getByText('배경 제거')).toBeInTheDocument()
      expect(screen.queryByText('이미지 선택')).not.toBeInTheDocument()
    })

    it('calls onBackgroundUpload when 이미지 선택 is clicked', async () => {
      const onBackgroundUpload = vi.fn()
      render(<PropertiesPanel {...baseProps} onBackgroundUpload={onBackgroundUpload} />)
      await userEvent.click(screen.getByText('이미지 선택'))
      expect(onBackgroundUpload).toHaveBeenCalled()
    })

    it('calls onBackgroundRemove when 배경 제거 is clicked', async () => {
      const onBackgroundRemove = vi.fn()
      render(<PropertiesPanel {...baseProps} backgroundImage="data:image/png;base64,abc" onBackgroundRemove={onBackgroundRemove} />)
      await userEvent.click(screen.getByText('배경 제거'))
      expect(onBackgroundRemove).toHaveBeenCalled()
    })

    it('shows "내보내기에 포함" checkbox when background is set', () => {
      render(<PropertiesPanel {...baseProps} backgroundImage="data:image/png;base64,abc" includeBgExport={true} onToggleBgExport={() => {}} />)
      expect(screen.getByText('내보내기에 포함')).toBeInTheDocument()
      const checkbox = screen.getByRole('checkbox')
      expect(checkbox).toBeChecked()
    })

    it('checkbox is unchecked when includeBgExport is false', () => {
      render(<PropertiesPanel {...baseProps} backgroundImage="data:image/png;base64,abc" includeBgExport={false} onToggleBgExport={() => {}} />)
      const checkbox = screen.getByRole('checkbox')
      expect(checkbox).not.toBeChecked()
    })

    it('does not show checkbox when no background', () => {
      render(<PropertiesPanel {...baseProps} />)
      expect(screen.queryByText('내보내기에 포함')).not.toBeInTheDocument()
    })

    it('calls onToggleBgExport when checkbox is clicked', async () => {
      const onToggleBgExport = vi.fn()
      render(<PropertiesPanel {...baseProps} backgroundImage="data:image/png;base64,abc" includeBgExport={true} onToggleBgExport={onToggleBgExport} />)
      await userEvent.click(screen.getByRole('checkbox'))
      expect(onToggleBgExport).toHaveBeenCalled()
    })
  })
})
