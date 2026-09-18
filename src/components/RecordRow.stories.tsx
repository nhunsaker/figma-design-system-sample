import type { Meta, StoryObj } from '@storybook/react-vite'
import { RecordRow } from './RecordRow'

const meta = {
  title: 'Pack/RecordRow',
  component: RecordRow,
  parameters: {
    docs: {
      description: {
        component:
          'Built from Badge rather than from a coloured dot of its own, so standing is said the same way here as everywhere else.',
      },
    },
  },
} satisfies Meta<typeof RecordRow>

export default meta
type Story = StoryObj<typeof meta>

export const Plain: Story = { args: { label: 'Pot odds', value: '84' } }
export const Strong: Story = {
  args: { label: 'Starting hands', value: '96', standing: 'Best', tone: 'success' },
}
export const Weak: Story = {
  args: { label: 'Position', value: '31', standing: 'Weak spot', tone: 'warning' },
}
