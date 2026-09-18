import type { ReactNode } from 'react'
import './Badge.css'

export type BadgeTone = 'neutral' | 'success' | 'warning' | 'danger'

export interface BadgeProps {
  tone?: BadgeTone
  children: ReactNode
}

/**
 * The word is the state. The colour agrees with the word and never replaces it, which is the
 * pack rule that says nothing is carried by colour alone.
 */
export function Badge({ tone = 'neutral', children }: BadgeProps) {
  return <span className={`ds-badge ds-badge--${tone}`}>{children}</span>
}
