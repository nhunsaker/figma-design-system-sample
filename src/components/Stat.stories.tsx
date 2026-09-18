import type { Meta, StoryObj } from '@storybook/react-vite'
import { Stat } from './Stat'

const meta = {
  title: 'Pack/Stat',
  component: Stat,
  parameters: {
    docs: {
      description: {
        component:
          'Figures are tabular, so a column of these lines up and a value going from 9 to 10 shifts nothing around it.',
      },
    },
  },
} satisfies Meta<typeof Stat>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = { args: { label: 'Hands played', value: '1,284' } }
export const WithHint: Story = {
  args: { label: 'Win rate', value: '42%', hint: 'Across 1,284 hands' },
}
export const Large: Story = { args: { label: 'Peak roll', value: '$12,480', size: 'large' } }
