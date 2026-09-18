import type { Meta, StoryObj } from '@storybook/react-vite'
import { App } from './App'

const meta = {
  title: 'Application/App',
  component: App,
  parameters: { layout: 'fullscreen' },
} satisfies Meta<typeof App>

export default meta
type Story = StoryObj<typeof meta>

const withSearch = (search: string) => {
  const url = new URL(window.location.href)
  url.search = search
  window.history.replaceState({}, '', url)
}

export const Default: Story = {
  render: () => {
    withSearch('')
    return <App />
  },
}

export const RollHistory: Story = {
  render: () => {
    withSearch('?roll-history=true')
    return <App />
  },
}
