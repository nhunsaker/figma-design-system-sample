import type { ButtonHTMLAttributes, ReactNode } from 'react'
import './Button.css'

export type ButtonVariant = 'primary' | 'secondary'
export type ButtonSize = 'default' | 'compact'

/**
 * `className` and `style` are deliberately not accepted. A caller who can pass a class can
 * reach around every rule in the pack, and then the pack describes something that is no longer
 * true. A variant the design needs is a variant added here, once, for everyone.
 */
export interface ButtonProps
  extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'className' | 'style'> {
  variant?: ButtonVariant
  size?: ButtonSize
  children: ReactNode
}

export function Button({
  variant = 'secondary',
  size = 'default',
  type = 'button',
  children,
  ...rest
}: ButtonProps) {
  return (
    <button className={`ds-button ds-button--${variant} ds-button--${size}`} type={type} {...rest}>
      {children}
    </button>
  )
}
