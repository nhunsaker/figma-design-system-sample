import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { expectNoAxeViolations } from '../a11y.test-utils'
import { Input } from './Input'

describe('Input', () => {
  it('ties the label to the control so clicking the label focuses it', () => {
    render(<Input label="Frame name" />)
    expect(screen.getByLabelText('Frame name')).toBeInTheDocument()
  })

  it('announces the error rather than only colouring the border', () => {
    render(<Input label="File key" invalid error="That is not a file key." />)
    const field = screen.getByLabelText('File key')
    expect(field).toHaveAttribute('aria-invalid', 'true')
    expect(field).toHaveAccessibleDescription('That is not a file key.')
  })

  it('does not describe the field when there is no error to describe', () => {
    render(<Input label="File key" invalid />)
    expect(screen.getByLabelText('File key')).not.toHaveAttribute('aria-describedby')
  })

  it('has no accessibility violations', async () => {
    const { container } = render(<Input label="File key" invalid error="Wrong shape." />)
    await expectNoAxeViolations(container)
  })
})
