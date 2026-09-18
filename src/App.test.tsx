import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { App } from './App'
import { expectNoAxeViolations } from './a11y.test-utils'
import { DesignSystem } from './components/DesignSystem'

const renderApp = () =>
  render(
    <DesignSystem>
      <App />
    </DesignSystem>,
  )

describe('App', () => {
  it('opens on the overview, which is the tab that answers the first question', () => {
    renderApp()
    expect(screen.getByText('Hands played')).toBeInTheDocument()
    expect(screen.queryByText('Starting hands')).toBeNull()
  })

  it('says the figures are examples rather than passing them off as a record', () => {
    renderApp()
    expect(screen.getByText(/example figures/i)).toBeInTheDocument()
  })

  it('keeps the weak spot callout behind its flag until a person turns it on', async () => {
    renderApp()
    await userEvent.click(screen.getByRole('tab', { name: 'Drills' }))
    expect(screen.getByText('Starting hands')).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Your weak spot' })).toBeNull()
  })

  it('says every standing as a word as well as a colour', async () => {
    renderApp()
    await userEvent.click(screen.getByRole('tab', { name: 'Drills' }))
    expect(screen.getByText('Weak spot')).toBeInTheDocument()
    expect(screen.getByText('Best')).toBeInTheDocument()
  })

  it('moves between tabs', async () => {
    renderApp()
    await userEvent.click(screen.getByRole('tab', { name: 'Venues' }))
    expect(screen.getByText('The Kitchen Table')).toBeInTheDocument()
  })

  it('has no accessibility violations', async () => {
    const { container } = renderApp()
    await expectNoAxeViolations(container)
  })
})
