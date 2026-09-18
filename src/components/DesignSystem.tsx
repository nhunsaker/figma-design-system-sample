import { BootstrapStyledProvider } from '@metatoy/bootstrap-styled'
import type { ReactNode } from 'react'
import '../../design-system/tokens.harbor.css'
import '../../design-system/tokens.ember.css'
import '../../design-system/tokens.components.css'
import '../../design-system/tokens.vendor.css'

export type Brand = 'harbor' | 'ember'

export interface DesignSystemProps {
  brand?: Brand
  children: ReactNode
}

/**
 * The root every surface sits inside.
 *
 * Two things happen here and they are deliberately the same decision. The brand class picks which
 * semantic values are live, and the vendor provider supplies the structural theme its components
 * read for things a custom property cannot carry, such as its own spacing scale.
 *
 * There is no default brand anywhere else in this system: a page with no brand class gets no
 * tokens and looks obviously broken, which is the right outcome. Here there is a default, because
 * this is the one place the choice is made and a required prop would only move the question.
 *
 * This is a pack component rather than a loose provider file because nothing outside
 * src/components may import the vendor library, and the check that enforces that does not make
 * exceptions for plumbing. A rule with one exception is a rule with as many as anyone needs.
 */
export function DesignSystem({ brand = 'harbor', children }: DesignSystemProps) {
  return (
    <BootstrapStyledProvider>
      <div className={`brand-${brand}`}>{children}</div>
    </BootstrapStyledProvider>
  )
}
