import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import SaveModal from '../SaveModal.jsx'

describe('SaveModal', () => {
  it('renders the form with given name', () => {
    render(
      <SaveModal saveName="테스트 패턴" onNameChange={() => {}} onConfirm={() => {}} onCancel={() => {}} />,
    )
    expect(screen.getByText('보관함에 저장')).toBeInTheDocument()
    expect(screen.getByDisplayValue('테스트 패턴')).toBeInTheDocument()
  })

  it('calls onNameChange when input changes', async () => {
    const onNameChange = vi.fn()
    render(
      <SaveModal saveName="" onNameChange={onNameChange} onConfirm={() => {}} onCancel={() => {}} />,
    )
    const input = screen.getByRole('textbox')
    await userEvent.type(input, '새 패턴')
    expect(onNameChange).toHaveBeenCalled()
  })

  it('calls onConfirm when 저장 button is clicked', async () => {
    const onConfirm = vi.fn()
    render(
      <SaveModal saveName="test" onNameChange={() => {}} onConfirm={onConfirm} onCancel={() => {}} />,
    )
    await userEvent.click(screen.getByText('저장'))
    expect(onConfirm).toHaveBeenCalled()
  })

  it('calls onCancel when 취소 button is clicked', async () => {
    const onCancel = vi.fn()
    render(
      <SaveModal saveName="test" onNameChange={() => {}} onConfirm={() => {}} onCancel={onCancel} />,
    )
    await userEvent.click(screen.getByText('취소'))
    expect(onCancel).toHaveBeenCalled()
  })

  it('calls onConfirm when Enter is pressed', async () => {
    const onConfirm = vi.fn()
    render(
      <SaveModal saveName="test" onNameChange={() => {}} onConfirm={onConfirm} onCancel={() => {}} />,
    )
    const input = screen.getByRole('textbox')
    await userEvent.type(input, '{Enter}')
    expect(onConfirm).toHaveBeenCalled()
  })

  it('calls onCancel when backdrop is clicked', async () => {
    const onCancel = vi.fn()
    const { container } = render(
      <SaveModal saveName="test" onNameChange={() => {}} onConfirm={() => {}} onCancel={onCancel} />,
    )
    await userEvent.click(container.firstChild)
    expect(onCancel).toHaveBeenCalled()
  })
})
