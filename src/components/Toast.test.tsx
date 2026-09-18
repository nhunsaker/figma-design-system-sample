import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { expectNoAxeViolations } from '../a11y.test-utils'
import { Toast } from './Toast'

describe('Toast', () => {
  it('reports politely by default', () => {
    render(<Toast>Frame read.</Toast>)
    expect(screen.getByRole('status')).toHaveAttribute('aria-live', 'polite')
  })

  it('interrupts for a failure, because bad news is worth the interruption', () => {
    render(<Toast tone="danger">The contract check failed.</Toast>)
    expect(screen.getByRole('alert')).toHaveAttribute('aria-live', 'assertive')
  })

  it('offers no dismiss control when there is nothing to dismiss to', () => {
    render(<Toast>Frame read.</Toast>)
    expect(screen.queryByRole('button')).toBeNull()
  })

  it('dismisses when asked', async () => {
    const onDismiss = vi.fn()
    render(<Toast onDismiss={onDismiss}>Pinned to the frame.</Toast>)
    await userEvent.click(screen.getByRole('button', { name: 'Dismiss' }))
    expect(onDismiss).toHaveBeenCalledOnce()
  })

  it('has no accessibility violations', async () => {
    const { container } = render(<Toast tone="danger">Failed.</Toast>)
    await expectNoAxeViolations(container)
  })
})
