import { Stack as VendorStack } from '@metatoy/bootstrap-styled'
import type { ReactNode } from 'react'
import './Stack.css'

export type StackGap = 'inline' | 'stack' | 'gutter'
export type StackAlign = 'start' | 'center' | 'baseline' | 'stretch'
export type StackJustify = 'start' | 'between' | 'end'

export interface StackProps {
  direction?: 'vertical' | 'horizontal'
  gap?: StackGap
  align?: StackAlign
  justify?: StackJustify
  /** Children share the space equally. Without it they take only what they need. */
  fill?: boolean
  wrap?: boolean
  children: ReactNode
}

/**
 * The only way to space things.
 *
 * Layout is a design decision, so it comes from the pack rather than from whatever stylesheet a
 * feature happens to own. Without this, every page grows its own spacing and the token layer
 * quietly stops describing the product.
 *
 * The vendor supplies the flex plumbing and this supplies the values, which is the shape of every
 * wrap in the pack: their structure, our tokens, and a caller who sees neither. `gap` names a
 * token rather than a number, so there is no way to ask for a spacing the system does not have.
 *
 * `justify` and `fill` exist because leaving them out was a bug rather than a simplification. A
 * row with no way to push its ends apart and no way to share width evenly is a row that collides
 * with itself, which is exactly what it did the first time this was looked at in a browser.
 */
export function Stack({
  direction = 'vertical',
  gap = 'stack',
  align = 'stretch',
  justify = 'start',
  fill = false,
  wrap = false,
  children,
}: StackProps) {
  const classes = [
    'ds-stack',
    `ds-stack--${gap}`,
    `ds-stack--${align}`,
    `ds-stack--justify-${justify}`,
    fill ? 'ds-stack--fill' : '',
    wrap ? 'ds-stack--wrap' : '',
  ]
  return (
    <VendorStack direction={direction} className={classes.filter(Boolean).join(' ')}>
      {children}
    </VendorStack>
  )
}
