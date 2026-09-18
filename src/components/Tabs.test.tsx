import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { expectNoAxeViolations } from '../a11y.test-utils'
import { type Tab, Tabs } from './Tabs'

const tabs: Tab[] = [
  { id: 'design', label: 'Design' },
  { id: 'code', label: 'Code' },
  { id: 'checks', label: 'Checks' },
]

const renderTabs = (selected = 'design', onSelect = vi.fn()) => {
  const result = render(
    <Tabs tabs={tabs} selected={selected} onSelect={onSelect}>
      <p>panel</p>
    </Tabs>,
  )
  return { ...result, onSelect }
}

describe('Tabs', () => {
  it('marks exactly one tab selected', () => {
    renderTabs()
    const selected = screen
      .getAllByRole('tab')
      .filter((t) => t.getAttribute('aria-selected') === 'true')
    expect(selected).toHaveLength(1)
    expect(selected[0]).toHaveAccessibleName('Design')
  })

  it('keeps only the selected tab in the tab order, which is what the pattern promises', () => {
    renderTabs()
    const stops = screen.getAllByRole('tab').filter((t) => t.getAttribute('tabindex') === '0')
    expect(stops).toHaveLength(1)
  })

  it('moves to the next tab on the right arrow', async () => {
    const { onSelect } = renderTabs()
    await userEvent.click(screen.getByRole('tab', { name: 'Design' }))
    await userEvent.keyboard('{ArrowRight}')
    expect(onSelect).toHaveBeenLastCalledWith('code')
  })

  it('wraps to the last tab on the left arrow from the first', async () => {
    const { onSelect } = renderTabs()
    await userEvent.click(screen.getByRole('tab', { name: 'Design' }))
    await userEvent.keyboard('{ArrowLeft}')
    expect(onSelect).toHaveBeenLastCalledWith('checks')
  })

  it('names the panel after the tab that opened it', () => {
    renderTabs()
    expect(screen.getByRole('tabpanel')).toHaveAccessibleName('Design')
  })

  it('has no accessibility violations', async () => {
    const { container } = renderTabs()
    await expectNoAxeViolations(container)
  })
})
