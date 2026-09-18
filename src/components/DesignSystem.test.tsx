import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { Button } from './Button'
import { DesignSystem } from './DesignSystem'

describe('DesignSystem', () => {
  it('puts the brand on the tree, which is what makes the tokens live', () => {
    const { container } = render(
      <DesignSystem brand="ember">
        <Button>Publish</Button>
      </DesignSystem>,
    )
    expect(container.querySelector('.brand-ember')).not.toBeNull()
  })

  it('defaults to a brand rather than rendering an unstyled page', () => {
    const { container } = render(
      <DesignSystem>
        <Button>Publish</Button>
      </DesignSystem>,
    )
    expect(container.querySelector('.brand-harbor')).not.toBeNull()
  })

  it('lets what is inside it render, which is the whole job', () => {
    render(
      <DesignSystem>
        <Button variant="primary">Publish</Button>
      </DesignSystem>,
    )
    expect(screen.getByRole('button', { name: 'Publish' })).toBeInTheDocument()
  })
})
