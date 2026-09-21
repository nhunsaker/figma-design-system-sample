import type { Meta, StoryObj } from '@storybook/react-vite'
import { App } from './App'
import { DesignSystem } from './components/DesignSystem'

const meta = {
  title: 'App/Player record',
  component: App,
  decorators: [
    (Story) => (
      <DesignSystem>
        <Story />
      </DesignSystem>
    ),
  ],
} satisfies Meta<typeof App>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}

export const RequestsRollHistory: Story = {
  args: {
    search: '?requests-roll-history=true',
    initialTab: 'requests',
  },
}
