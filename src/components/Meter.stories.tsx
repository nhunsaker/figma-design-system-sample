import type { Meta, StoryObj } from '@storybook/react-vite'
import { Meter } from './Meter'

const meta = {
  title: 'Pack/Meter',
  component: Meter,
  parameters: {
    docs: {
      description: {
        component:
          'The bar is the quick read and the number is the actual answer. A bar on its own is a shape nobody can quote.',
      },
    },
  },
} satisfies Meta<typeof Meter>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = { args: { label: 'Showdowns won', value: 62 } }
export const Success: Story = {
  args: { label: 'Pot odds called correctly', value: 88, tone: 'success' },
}
export const Warning: Story = { args: { label: 'Position awareness', value: 34, tone: 'warning' } }
export const Clamped: Story = {
  args: { label: 'A value outside the range is clamped, not drawn wrong', value: 140 },
}
