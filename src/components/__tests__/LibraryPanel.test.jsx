import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import LibraryPanel from '../LibraryPanel.jsx'

const samplePattern = {
  id: 'p1',
  name: '테스트 패턴',
  createdAt: 1700000000000,
  shapes: [{ id: 's1', type: 'line', x1: 0, y1: 0, x2: 100, y2: 0 }],
}

describe('LibraryPanel', () => {
  it('shows empty hint when no patterns saved', () => {
    render(<LibraryPanel savedPatterns={[]} onLoad={() => {}} onDelete={() => {}} />)
    expect(screen.getByText(/아직 저장된 패턴이 없습니다/)).toBeInTheDocument()
  })

  it('renders saved patterns', () => {
    render(<LibraryPanel savedPatterns={[samplePattern]} onLoad={() => {}} onDelete={() => {}} />)
    expect(screen.getByText('테스트 패턴')).toBeInTheDocument()
    expect(screen.getByText(/요소 1개/)).toBeInTheDocument()
  })

  it('calls onLoad when 불러오기 is clicked', async () => {
    const onLoad = vi.fn()
    render(<LibraryPanel savedPatterns={[samplePattern]} onLoad={onLoad} onDelete={() => {}} />)
    await userEvent.click(screen.getByText('불러오기'))
    expect(onLoad).toHaveBeenCalledWith(samplePattern)
  })

  it('calls onDelete when 삭제 is clicked', async () => {
    const onDelete = vi.fn()
    render(<LibraryPanel savedPatterns={[samplePattern]} onLoad={() => {}} onDelete={onDelete} />)
    await userEvent.click(screen.getByText('삭제'))
    expect(onDelete).toHaveBeenCalledWith('p1')
  })
})
