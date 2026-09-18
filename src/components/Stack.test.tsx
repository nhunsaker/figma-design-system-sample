import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { expectNoAxeViolations } from '../a11y.test-utils'
import { DesignSystem } from './DesignSystem'
import { Stack } from './Stack'

describe('Stack', () => {
  it('carries the gap as a token name, not a number', () => {
    const { container } = render(
      <DesignSystem>
        <Stack gap="gutter">
          <span>one</span>
        </Stack>
      </DesignSystem>,
    )
    expect(container.querySelector('.ds-stack--gutter')).not.toBeNull()
  })

  it('defaults to a vertical stack, which is what most layouts are', () => {
    render(
      <DesignSystem>
        <Stack>
          <span>one</span>
        </Stack>
      </DesignSystem>,
    )
    expect(screen.getByText('one')).toBeInTheDocument()
  })

  it('can push its ends apart, which a row of two things usually needs', () => {
    const { container } = render(
      <DesignSystem>
        <Stack direction="horizontal" justify="between">
          <span>one</span>
          <span>two</span>
        </Stack>
      </DesignSystem>,
    )
    expect(container.querySelector('.ds-stack--justify-between')).not.toBeNull()
  })

  it('can share its width evenly, which a row of figures usually needs', () => {
    const { container } = render(
      <DesignSystem>
        <Stack direction="horizontal" fill>
          <span>one</span>
          <span>two</span>
        </Stack>
      </DesignSystem>,
    )
    expect(container.querySelector('.ds-stack--fill')).not.toBeNull()
  })

  it('has no accessibility violations', async () => {
    const { container } = render(
      <DesignSystem>
        <Stack direction="horizontal">
          <span>one</span>
        </Stack>
      </DesignSystem>,
    )
    await expectNoAxeViolations(container)
  })
})
