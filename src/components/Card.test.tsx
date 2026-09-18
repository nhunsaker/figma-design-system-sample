import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { expectNoAxeViolations } from '../a11y.test-utils'
import { Card } from './Card'

describe('Card', () => {
  it('renders the title as a heading so the page keeps an outline', () => {
    render(<Card title="Ready for development">body</Card>)
    expect(screen.getByRole('heading', { name: 'Ready for development' })).toBeInTheDocument()
  })

  it('omits the footer entirely when there is nothing in it', () => {
    const { container } = render(<Card title="Plain">body</Card>)
    expect(container.querySelector('.ds-card__footer')).toBeNull()
  })

  it('has no accessibility violations', async () => {
    const { container } = render(
      <Card title="Pull request 14" footer={<span>footer</span>}>
        body
      </Card>,
    )
    await expectNoAxeViolations(container)
  })
})
