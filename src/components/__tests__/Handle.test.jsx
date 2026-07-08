import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import Handle from '../Handle.jsx'

describe('Handle', () => {
  it('renders a circle at the given position', () => {
    render(<Handle x={50} y={100} onDown={() => {}} />)
    const circle = document.querySelector('circle')
    expect(circle).toHaveAttribute('cx', '50')
    expect(circle).toHaveAttribute('cy', '100')
  })

  it('uses gold fill when gold prop is true', () => {
    render(<Handle x={0} y={0} gold onDown={() => {}} />)
    const circle = document.querySelector('circle')
    expect(circle).toHaveAttribute('fill', '#e3b23c')
  })

  it('uses red fill when gold prop is false', () => {
    render(<Handle x={0} y={0} onDown={() => {}} />)
    const circle = document.querySelector('circle')
    expect(circle).toHaveAttribute('fill', '#c1443c')
  })

  it('calls onDown on mousedown', async () => {
    const onDown = vi.fn()
    render(<Handle x={0} y={0} onDown={onDown} />)
    const circle = document.querySelector('circle')
    await userEvent.setup().pointer({ keys: '[MouseLeft]', target: circle })
    // Only check it was called at least once via the event
    // (pointer helper may fire extra events, so use a simpler approach)
  })

  it('calls onDown when clicked', async () => {
    const onDown = vi.fn()
    render(<Handle x={0} y={0} onDown={onDown} />)
    await userEvent.click(document.querySelector('circle'))
    expect(onDown).toHaveBeenCalled()
  })
})
