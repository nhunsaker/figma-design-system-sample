import { render, screen, within } from '@testing-library/react'
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

  it('keeps Requests roll history behind its flag until a person turns it on', () => {
    renderApp()
    expect(screen.queryByRole('tab', { name: 'Requests' })).toBeNull()
  })

  it('builds the Requests roll history frame when its flag is on', () => {
    render(
      <DesignSystem>
        <App search="?requests-roll-history=true" initialTab="requests" />
      </DesignSystem>,
    )

    expect(screen.getByRole('tab', { name: 'Requests' })).toBeInTheDocument()
    const panel = screen.getByRole('tabpanel')
    const scope = within(panel)
    expect(
      scope.getByRole('heading', { level: 2, name: 'Roll over the last 90 days' }),
    ).toBeInTheDocument()
    expect(scope.getByText('Peak')).toBeInTheDocument()
    expect(scope.getByText('$12,480')).toBeInTheDocument()
    expect(scope.getByText('Low')).toBeInTheDocument()
    expect(scope.getByText('$1,205')).toBeInTheDocument()
    expect(scope.getByText('Now')).toBeInTheDocument()
    expect(scope.getByText('$8,930')).toBeInTheDocument()
    expect(scope.getByRole('note', { name: 'Sparkline, not built' })).toBeInTheDocument()
  })

  it('falls back to a real tab if Requests is removed after mount', () => {
    const { rerender } = render(
      <DesignSystem>
        <App search="?requests-roll-history=true" initialTab="requests" />
      </DesignSystem>,
    )

    rerender(
      <DesignSystem>
        <App search="" initialTab="requests" />
      </DesignSystem>,
    )

    expect(screen.queryByRole('tab', { name: 'Requests' })).toBeNull()
    expect(screen.getByText('Hands played')).toBeInTheDocument()
  })

  it('has no accessibility violations', async () => {
    const { container } = renderApp()
    await expectNoAxeViolations(container)
  })
})
