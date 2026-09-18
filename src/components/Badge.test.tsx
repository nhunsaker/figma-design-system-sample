import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { expectNoAxeViolations } from '../a11y.test-utils'
import { Badge } from './Badge'

describe('Badge', () => {
  it('says the state as a word, so colour is never the only carrier', () => {
    render(<Badge tone="danger">Checks failed</Badge>)
    expect(screen.getByText('Checks failed')).toBeInTheDocument()
  })

  it('defaults to the neutral tone', () => {
    render(<Badge>Draft</Badge>)
    expect(screen.getByText('Draft')).toHaveClass('ds-badge--neutral')
  })

  it('has no accessibility violations', async () => {
    const { container } = render(<Badge tone="success">Merged</Badge>)
    await expectNoAxeViolations(container)
  })
})
