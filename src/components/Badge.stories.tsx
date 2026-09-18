import type { Meta, StoryObj } from '@storybook/react-vite'
import { Badge } from './Badge'

const meta = {
  title: 'Pack/Badge',
  component: Badge,
  parameters: {
    docs: {
      description: {
        component:
          'The word is the state and the colour agrees with it. Read the tones with the page in greyscale: every one still says what it means.',
      },
    },
  },
} satisfies Meta<typeof Badge>

export default meta
type Story = StoryObj<typeof meta>

export const Neutral: Story = { args: { children: 'Draft' } }
export const Success: Story = { args: { tone: 'success', children: 'Merged' } }
export const Warning: Story = { args: { tone: 'warning', children: 'Needs review' } }
export const Danger: Story = { args: { tone: 'danger', children: 'Checks failed' } }
