import type { Meta, StoryObj } from '@storybook/react-vite'
import { useEffect } from 'react'
import { App } from './App'
import { DesignSystem } from './components/DesignSystem'

const meta = {
  title: 'App',
  component: App,
  decorators: [
    (Story) => (
      <DesignSystem brand="harbor">
        <Story />
      </DesignSystem>
    ),
  ],
} satisfies Meta<typeof App>

export default meta
type Story = StoryObj<typeof meta>

function WithSearch({ search }: { search: string }) {
  useEffect(() => {
    const original = window.location.search
    window.history.replaceState({}, '', `${window.location.pathname}${search}`)
    return () => {
      window.history.replaceState({}, '', `${window.location.pathname}${original}`)
    }
  }, [search])

  return <App />
}

export const Default: Story = {}

export const RollHistory: Story = {
  render: () => <WithSearch search="?roll-history=true" />,
}
