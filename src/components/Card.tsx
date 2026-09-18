import type { ReactNode } from 'react'
import './Card.css'

export interface CardProps {
  title: string
  as?: 'section' | 'article' | 'div'
  footer?: ReactNode
  children: ReactNode
}

/**
 * A card groups one subject. The title is always rendered as a heading so the page keeps an
 * outline a screen reader can move through, which is why `title` is required rather than a slot.
 */
export function Card({ title, as: Tag = 'section', footer, children }: CardProps) {
  return (
    <Tag className="ds-card">
      <h2 className="ds-card__title">{title}</h2>
      <div className="ds-card__body">{children}</div>
      {footer ? <div className="ds-card__footer">{footer}</div> : null}
    </Tag>
  )
}
