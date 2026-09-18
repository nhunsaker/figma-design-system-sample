import type { Meta, StoryObj } from '@storybook/react-vite'
import { Button } from './Button'

const meta = {
  title: 'Pack/Button',
  component: Button,
  parameters: {
    docs: {
      description: {
        component:
          'At most one primary button on a screen. The primary is the action the screen exists for, and the accent belongs to it.',
      },
    },
  },
} satisfies Meta<typeof Button>

export default meta
type Story = StoryObj<typeof meta>

export const Primary: Story = { args: { variant: 'primary', children: 'Publish' } }
export const Secondary: Story = { args: { variant: 'secondary', children: 'Save draft' } }
export const Compact: Story = {
  args: { variant: 'secondary', size: 'compact', children: 'Filter' },
}
export const Disabled: Story = { args: { variant: 'primary', disabled: true, children: 'Publish' } }
