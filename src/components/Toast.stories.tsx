import type { Meta, StoryObj } from '@storybook/react-vite'
import { Toast } from './Toast'

const meta = {
  title: 'Pack/Toast',
  component: Toast,
  parameters: {
    docs: {
      description: {
        component:
          'A toast reports, it never asks. A failure is announced assertively and everything else politely, so bad news arrives when it happens and good news waits for a pause.',
      },
    },
  },
} satisfies Meta<typeof Toast>

export default meta
type Story = StoryObj<typeof meta>

export const Neutral: Story = { args: { children: 'Frame read. Opening an issue.' } }
export const Success: Story = { args: { tone: 'success', children: 'Pull request 14 is open.' } }
export const Danger: Story = {
  args: { tone: 'danger', children: 'The contract check found two problems.' },
}
export const Dismissible: Story = {
  args: { tone: 'success', children: 'Pinned to the frame.', onDismiss: () => {} },
}
