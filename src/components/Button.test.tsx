import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { expectNoAxeViolations } from '../a11y.test-utils'
import { Button } from './Button'

describe('Button', () => {
  it('defaults to type button so it never submits a form by accident', () => {
    render(<Button>Save</Button>)
    expect(screen.getByRole('button', { name: 'Save' })).toHaveAttribute('type', 'button')
  })

  it('carries the variant and size on the class so one stylesheet describes every state', () => {
    render(
      <Button variant="primary" size="compact">
        Publish
      </Button>,
    )
    const button = screen.getByRole('button', { name: 'Publish' })
    expect(button).toHaveClass('ds-button', 'ds-button--primary', 'ds-button--compact')
  })

  it('does not fire when disabled', async () => {
    const onClick = vi.fn()
    render(
      <Button disabled onClick={onClick}>
        Publish
      </Button>,
    )
    screen.getByRole('button', { name: 'Publish' }).click()
    expect(onClick).not.toHaveBeenCalled()
  })

  it('has no accessibility violations', async () => {
    const { container } = render(<Button variant="primary">Publish</Button>)
    await expectNoAxeViolations(container)
  })
})
