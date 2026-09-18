import type { Meta, StoryObj } from '@storybook/react-vite'
import { useState } from 'react'
import { type Tab, Tabs } from './Tabs'

const tabs: Tab[] = [
  { id: 'design', label: 'Design' },
  { id: 'code', label: 'Code' },
  { id: 'checks', label: 'Checks' },
]

const meta = {
  title: 'Pack/Tabs',
  component: Tabs,
  parameters: {
    docs: {
      description: {
        component:
          'Tabs are peers, not steps. Arrow keys move between them, because a control that looks like a tab and ignores an arrow key is a broken promise.',
      },
    },
  },
} satisfies Meta<typeof Tabs>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  args: { tabs, selected: 'design', onSelect: () => {}, children: null },
  render: (args) => {
    const [selected, setSelected] = useState(args.selected)
    return (
      <Tabs {...args} selected={selected} onSelect={setSelected}>
        <p>Showing the {selected} view.</p>
      </Tabs>
    )
  },
}
