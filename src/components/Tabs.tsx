import type { KeyboardEvent, ReactNode } from 'react'
import { useId } from 'react'
import './Tabs.css'

export interface Tab {
  id: string
  label: string
}

export interface TabsProps {
  tabs: Tab[]
  selected: string
  onSelect: (id: string) => void
  children: ReactNode
}

/**
 * Tabs are peers, not steps: the choice is cheap and reversible. Arrow keys move between them
 * because that is what the tab pattern promises, and a control that looks like a tab and does
 * not answer an arrow key is a broken promise rather than a missing nicety.
 */
export function Tabs({ tabs, selected, onSelect, children }: TabsProps) {
  const base = useId()
  const current = Math.max(
    0,
    tabs.findIndex((t) => t.id === selected),
  )

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const delta = event.key === 'ArrowRight' ? 1 : event.key === 'ArrowLeft' ? -1 : 0
    if (delta === 0) return
    event.preventDefault()
    const next = tabs[(current + delta + tabs.length) % tabs.length]
    if (next) onSelect(next.id)
  }

  return (
    <div className="ds-tabs">
      <div className="ds-tabs__list" role="tablist" onKeyDown={onKeyDown}>
        {tabs.map((tab) => {
          const isSelected = tab.id === selected
          return (
            <button
              key={tab.id}
              type="button"
              role="tab"
              id={`${base}-${tab.id}-tab`}
              aria-controls={`${base}-${tab.id}-panel`}
              aria-selected={isSelected}
              tabIndex={isSelected ? 0 : -1}
              className="ds-tabs__tab"
              onClick={() => onSelect(tab.id)}
            >
              {tab.label}
            </button>
          )
        })}
      </div>
      <div
        className="ds-tabs__panel"
        role="tabpanel"
        id={`${base}-${selected}-panel`}
        aria-labelledby={`${base}-${selected}-tab`}
        // biome-ignore lint/a11y/noNoninteractiveTabindex: a tabpanel holding no focusable element must take focus itself, or the arrow key that selected it strands the reader on a panel they cannot reach
        tabIndex={0}
      >
        {children}
      </div>
    </div>
  )
}
