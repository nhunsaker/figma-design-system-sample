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

const withSearch = (search: string) => {
  const url = `${globalThis.location.pathname}${search}`
  globalThis.history.pushState({}, '', url)
}

describe('App', () => {
  it('keeps roll history behind its flag until a person turns it on', () => {
    withSearch('')
    renderApp()
    expect(screen.queryByRole('heading', { name: 'Roll over the last 90 days' })).toBeNull()
  })

  it('shows roll history when the flag is on', () => {
    withSearch('?roll-history=true')
    renderApp()
    expect(screen.getByRole('heading', { name: 'Roll over the last 90 days' })).toBeInTheDocument()
    expect(screen.getByText('Peak')).toBeInTheDocument()
    expect(screen.getByText('$8,930')).toBeInTheDocument()
  })

  it('opens on the overview, which is the tab that answers the first question', () => {
    withSearch('')
    renderApp()
    expect(screen.getByText('Hands played')).toBeInTheDocument()
    expect(screen.queryByText('Starting hands')).toBeNull()
  })

  it('says the figures are examples rather than passing them off as a record', () => {
    withSearch('')
    renderApp()
    expect(screen.getByText(/example figures/i)).toBeInTheDocument()
  })

  it('keeps the weak spot callout behind its flag until a person turns it on', async () => {
    withSearch('')
    renderApp()
    await userEvent.click(screen.getByRole('tab', { name: 'Drills' }))
    expect(screen.getByText('Starting hands')).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Your weak spot' })).toBeNull()
  })

  it('says every standing as a word as well as a colour', async () => {
    withSearch('')
    renderApp()
    await userEvent.click(screen.getByRole('tab', { name: 'Drills' }))
    expect(screen.getByText('Weak spot')).toBeInTheDocument()
    expect(screen.getByText('Best')).toBeInTheDocument()
  })

  it('moves between tabs', async () => {
    withSearch('')
    renderApp()
    await userEvent.click(screen.getByRole('tab', { name: 'Venues' }))
    expect(screen.getByText('The Kitchen Table')).toBeInTheDocument()
  })

  it('has no accessibility violations', async () => {
    withSearch('')
    const { container } = renderApp()
    await expectNoAxeViolations(container)
  })
})
