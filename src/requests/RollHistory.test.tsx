import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { expectNoAxeViolations } from '../a11y.test-utils'
import { DesignSystem } from '../components/DesignSystem'
import { RollHistory } from './RollHistory'

describe('RollHistory', () => {
  it('renders the requested copy and figures', () => {
    render(
      <DesignSystem>
        <RollHistory />
      </DesignSystem>,
    )

    expect(screen.getByRole('heading', { name: 'Roll over the last 90 days' })).toBeInTheDocument()
    expect(screen.getByText('Peak')).toBeInTheDocument()
    expect(screen.getByText('$12,480')).toBeInTheDocument()
    expect(screen.getByText('Low')).toBeInTheDocument()
    expect(screen.getByText('$1,205')).toBeInTheDocument()
    expect(screen.getByText('Now')).toBeInTheDocument()
    expect(screen.getByText('$8,930')).toBeInTheDocument()
  })

  it('uses Missing for the unmapped sparkline', () => {
    render(
      <DesignSystem>
        <RollHistory />
      </DesignSystem>,
    )

    expect(screen.getByRole('note', { name: 'Sparkline, not built' })).toBeInTheDocument()
  })

  it('has no accessibility violations', async () => {
    const { container } = render(
      <DesignSystem>
        <RollHistory />
      </DesignSystem>,
    )
    await expectNoAxeViolations(container)
  })
})
