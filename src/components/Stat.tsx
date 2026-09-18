import './Stat.css'

export interface StatProps {
  label: string
  value: string
  hint?: string
  size?: 'default' | 'large'
}

/**
 * One figure and what it means.
 *
 * The figure is tabular and the label sits above it, so a grid of these lines up down the column
 * and a value changing from 9 to 10 does not shift anything around it. That is the pack rule
 * about figures, and a stats screen is the only place it can actually be seen.
 */
export function Stat({ label, value, hint, size = 'default' }: StatProps) {
  return (
    <div className={`ds-stat ds-stat--${size}`}>
      <span className="ds-stat__label">{label}</span>
      <span className="ds-stat__value">{value}</span>
      {hint ? <span className="ds-stat__hint">{hint}</span> : null}
    </div>
  )
}
