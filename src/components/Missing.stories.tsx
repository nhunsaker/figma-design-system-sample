import type { Meta, StoryObj } from '@storybook/react-vite'
import { Missing } from './Missing'

const meta = {
  title: 'Pack/Missing',
  component: Missing,
  parameters: {
    docs: {
      description: {
        component:
          'A component the design asked for that the pack cannot build. It exists so a refusal ' +
          'is visible: without it, a component the system honestly declined to guess at and a ' +
          'component somebody forgot look identical in the built page. It is deliberately plain, ' +
          'because a placeholder that looks finished is a placeholder that ships.',
      },
    },
  },
} satisfies Meta<typeof Missing>

export default meta
type Story = StoryObj<typeof meta>

/** What the reader reports when it could not measure the component. */
export const NameOnly: Story = { args: { name: 'Timeline' } }

/** A wide, short component. The placeholder keeps the proportion the design gave it. */
export const Banded: Story = { args: { name: 'Timeline', width: 672, height: 80 } }

/** A small square one, to show the same component carries any shape. */
export const Square: Story = { args: { name: 'Avatar', width: 48, height: 48 } }
