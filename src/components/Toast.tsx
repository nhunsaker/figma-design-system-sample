import type { ReactNode } from 'react'
import './Toast.css'

export type ToastTone = 'neutral' | 'success' | 'danger'

export interface ToastProps {
  tone?: ToastTone
  onDismiss?: () => void
  children: ReactNode
}

/**
 * A toast reports, it never asks. Anything that needs an answer is a dialog, because a message
 * that disappears on its own is the wrong place to put a decision.
 *
 * A failure is announced assertively and everything else politely, so a person using a screen
 * reader hears the bad news at the moment it happens and the good news when they next pause.
 */
export function Toast({ tone = 'neutral', onDismiss, children }: ToastProps) {
  return (
    <div
      className={`ds-toast ds-toast--${tone}`}
      role={tone === 'danger' ? 'alert' : 'status'}
      aria-live={tone === 'danger' ? 'assertive' : 'polite'}
    >
      <span className="ds-toast__message">{children}</span>
      {onDismiss ? (
        <button type="button" className="ds-toast__dismiss" onClick={onDismiss}>
          Dismiss
        </button>
      ) : null}
    </div>
  )
}
