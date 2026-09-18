import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { App } from './App'
import { expectNoAxeViolations } from './a11y.test-utils'

describe('App', () => {
  it('opens on the frames that are ready, which is the only list anyone acts on', () => {
    render(<App />)
    expect(screen.getByRole('heading', { name: 'Empty state' })).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Request row' })).toBeNull()
  })

  it('keeps the search behind its flag until a person turns the flag on', () => {
    render(<App />)
    expect(screen.queryByLabelText('Find a frame')).toBeNull()
  })

  it('says every status as a word as well as a colour', () => {
    render(<App />)
    expect(screen.getAllByText('Ready for development').length).toBeGreaterThan(0)
  })

  it('has no accessibility violations', async () => {
    const { container } = render(<App />)
    await expectNoAxeViolations(container)
  })
})
