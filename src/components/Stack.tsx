import { Stack as VendorStack } from '@metatoy/bootstrap-styled'
import type { ReactNode } from 'react'
import './Stack.css'

export type StackGap = 'inline' | 'stack' | 'gutter'
export type StackAlign = 'start' | 'center' | 'baseline' | 'stretch'

export interface StackProps {
  direction?: 'vertical' | 'horizontal'
  gap?: StackGap
  align?: StackAlign
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
 * The vendor supplies the flex plumbing and this supplies the gap, which is the shape of every
 * wrap in the pack: their structure, our values, and a caller who sees neither. `gap` names a
 * token rather than a number, so there is no way to ask for a spacing the system does not have.
 */
export function Stack({
  direction = 'vertical',
  gap = 'stack',
  align = 'stretch',
  wrap = false,
  children,
}: StackProps) {
  const classes = [
    'ds-stack',
    `ds-stack--${gap}`,
    `ds-stack--${align}`,
    wrap ? 'ds-stack--wrap' : '',
  ]
  return (
    <VendorStack direction={direction} className={classes.filter(Boolean).join(' ')}>
      {children}
    </VendorStack>
  )
}
