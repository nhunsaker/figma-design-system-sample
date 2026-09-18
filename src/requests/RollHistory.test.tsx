import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { expectNoAxeViolations } from '../a11y.test-utils'
import { DesignSystem } from '../components/DesignSystem'
import { RollHistory } from './RollHistory'

describe('RollHistory', () => {
  it('shows the mapped copy from the frame', () => {
    render(
      <DesignSystem>
        <RollHistory />
      </DesignSystem>,
    )

    expect(screen.getAllByText('Roll over the last 90 days')).toHaveLength(2)
    expect(screen.getByText('Peak')).toBeInTheDocument()
    expect(screen.getByText('$12,480')).toBeInTheDocument()
    expect(screen.getByText('Low')).toBeInTheDocument()
    expect(screen.getByText('$1,205')).toBeInTheDocument()
    expect(screen.getByText('Now')).toBeInTheDocument()
    expect(screen.getByText('$8,930')).toBeInTheDocument()
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
