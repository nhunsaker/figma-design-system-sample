import type { InputHTMLAttributes } from 'react'
import { useId } from 'react'
import './Input.css'

export interface InputProps
  extends Omit<InputHTMLAttributes<HTMLInputElement>, 'className' | 'style' | 'id'> {
  label: string
  invalid?: boolean
  error?: string
  type?: 'text' | 'email' | 'search'
}

/**
 * The label is always rendered and is never a placeholder: a placeholder disappears the moment
 * a person starts typing, which is exactly when they need it. The error message is adjacent and
 * wired with aria-describedby, so the failure is announced rather than only coloured.
 */
export function Input({ label, invalid = false, error, type = 'text', ...rest }: InputProps) {
  const id = useId()
  const errorId = `${id}-error`
  const showError = Boolean(invalid && error)
  return (
    <div className="ds-input">
      <label className="ds-input__label" htmlFor={id}>
        {label}
      </label>
      <input
        id={id}
        className="ds-input__control"
        type={type}
        aria-invalid={invalid || undefined}
        aria-describedby={showError ? errorId : undefined}
        {...rest}
      />
      {showError ? (
        <p className="ds-input__error" id={errorId}>
          {error}
        </p>
      ) : null}
    </div>
  )
}
