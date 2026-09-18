import type { Meta, StoryObj } from '@storybook/react-vite'
import { DesignSystem } from '../components/DesignSystem'
import { RollHistory } from './RollHistory'

const meta = {
  title: 'Requests/Roll history',
  component: RollHistory,
  decorators: [
    (Story) => (
      <DesignSystem>
        <Story />
      </DesignSystem>
    ),
  ],
} satisfies Meta<typeof RollHistory>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
