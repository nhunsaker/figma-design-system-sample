import type { Meta, StoryObj } from '@storybook/react-vite'
import { RollHistory } from './RollHistory'

const meta = {
  title: 'Requests/RollHistory',
  component: RollHistory,
  parameters: {
    docs: {
      description: {
        component:
          'The mapped part of the Roll history request. The Sparkline is deliberately left out because it is not in the pack.',
      },
    },
  },
} satisfies Meta<typeof RollHistory>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
