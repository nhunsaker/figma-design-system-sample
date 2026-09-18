import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { expectNoAxeViolations } from '../a11y.test-utils'
import { Missing } from './Missing'

describe('Missing', () => {
  it('names the component that is not there', () => {
    render(<Missing name="Timeline" />)
    expect(screen.getByText('Timeline')).toBeInTheDocument()
  })

  it('says why, so a gap cannot be read as an oversight', () => {
    render(<Missing name="Timeline" />)
    expect(screen.getByText(/not in the design pack/i)).toBeInTheDocument()
  })

  it('carries the component name in its accessible name', () => {
    render(<Missing name="Timeline" />)
    expect(screen.getByRole('note', { name: 'Timeline, not built' })).toBeInTheDocument()
  })

  it('reserves the size the design gave it', () => {
    const { container } = render(<Missing name="Timeline" width={672} height={80} />)
    const style = container.querySelector<HTMLElement>('.ds-missing')?.getAttribute('style') ?? ''
    expect(style).toContain('--frame-w: 672px')
    expect(style).toContain('--frame-h: 80px')
  })

  it('reserves nothing when the reader could not measure it, and falls back to a token', () => {
    const { container } = render(<Missing name="Timeline" />)
    const style = container.querySelector<HTMLElement>('.ds-missing')?.getAttribute('style') ?? ''
    expect(style).not.toContain('--frame-w')
    expect(style).not.toContain('--frame-h')
  })

  it('is one component for any shape, not one per missing thing', () => {
    const { container } = render(
      <>
        <Missing name="Avatar" width={48} height={48} />
        <Missing name="Timeline" width={672} height={80} />
      </>,
    )
    expect(container.querySelectorAll('.ds-missing')).toHaveLength(2)
    expect(screen.getByText('Avatar')).toBeInTheDocument()
    expect(screen.getByText('Timeline')).toBeInTheDocument()
  })

  it('has no accessibility violations', async () => {
    const { container } = render(<Missing name="Timeline" width={672} height={80} />)
    await expectNoAxeViolations(container)
  })
})
