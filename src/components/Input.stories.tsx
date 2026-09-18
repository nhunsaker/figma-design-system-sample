import type { Meta, StoryObj } from '@storybook/react-vite'
import { Input } from './Input'

const meta = {
  title: 'Pack/Input',
  component: Input,
  parameters: {
    docs: {
      description: {
        component:
          'The label is always present. A placeholder that doubles as a label disappears the moment a person starts typing, which is exactly when they need it.',
      },
    },
  },
} satisfies Meta<typeof Input>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  args: { label: 'Frame name', placeholder: 'Requests / Empty state' },
}
export const Required: Story = { args: { label: 'Branch', required: true, defaultValue: 'main' } }
export const Invalid: Story = {
  args: {
    label: 'Figma file key',
    invalid: true,
    error: 'That is not a file key. Copy it from the file URL, between /design/ and the file name.',
    defaultValue: 'https://figma.com/design/...',
  },
}
