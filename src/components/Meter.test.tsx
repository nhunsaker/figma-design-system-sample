import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { expectNoAxeViolations } from '../a11y.test-utils'
import { DesignSystem } from './DesignSystem'
import { Meter } from './Meter'

describe('Meter', () => {
  it('says the number as well as drawing the bar', () => {
    render(
      <DesignSystem>
        <Meter label="Showdowns won" value={62} />
      </DesignSystem>,
    )
    expect(screen.getByText('62%')).toBeInTheDocument()
  })

  it('clamps a value outside the range rather than drawing it wrong', () => {
    render(
      <DesignSystem>
        <Meter label="Over" value={140} />
      </DesignSystem>,
    )
    expect(screen.getByText('100%')).toBeInTheDocument()
  })

  it('clamps a negative value to zero', () => {
    render(
      <DesignSystem>
        <Meter label="Under" value={-20} />
      </DesignSystem>,
    )
    expect(screen.getByText('0%')).toBeInTheDocument()
  })

  it('rounds rather than printing a figure nobody meant', () => {
    render(
      <DesignSystem>
        <Meter label="Odd" value={62.4} />
      </DesignSystem>,
    )
    expect(screen.getByText('62%')).toBeInTheDocument()
  })

  it('has no accessibility violations', async () => {
    const { container } = render(
      <DesignSystem>
        <Meter label="Showdowns won" value={62} tone="success" />
      </DesignSystem>,
    )
    await expectNoAxeViolations(container)
  })
})
