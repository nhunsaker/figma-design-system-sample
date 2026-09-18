import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { expectNoAxeViolations } from '../a11y.test-utils'
import { Stat } from './Stat'

describe('Stat', () => {
  it('shows the label and the figure', () => {
    render(<Stat label="Hands played" value="1,284" />)
    expect(screen.getByText('Hands played')).toBeInTheDocument()
    expect(screen.getByText('1,284')).toBeInTheDocument()
  })

  it('leaves out the hint rather than reserving empty space for it', () => {
    const { container } = render(<Stat label="Win rate" value="42%" />)
    expect(container.querySelector('.ds-stat__hint')).toBeNull()
  })

  it('has no accessibility violations', async () => {
    const { container } = render(<Stat label="Win rate" value="42%" hint="Across 1,284 hands" />)
    await expectNoAxeViolations(container)
  })
})
