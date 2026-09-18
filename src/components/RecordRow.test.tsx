import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { expectNoAxeViolations } from '../a11y.test-utils'
import { RecordRow } from './RecordRow'

describe('RecordRow', () => {
  it('says the standing as a word, through the same badge everything else uses', () => {
    render(<RecordRow label="Position" value="31" standing="Weak spot" tone="warning" />)
    expect(screen.getByText('Weak spot')).toHaveClass('ds-badge--warning')
  })

  it('omits the badge when there is no standing to report', () => {
    const { container } = render(<RecordRow label="Pot odds" value="84" />)
    expect(container.querySelector('.ds-badge')).toBeNull()
  })

  it('has no accessibility violations', async () => {
    const { container } = render(
      <RecordRow label="Position" value="31" standing="Weak spot" tone="warning" />,
    )
    await expectNoAxeViolations(container)
  })
})
