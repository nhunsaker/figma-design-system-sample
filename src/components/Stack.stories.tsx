import type { Meta, StoryObj } from '@storybook/react-vite'
import { Badge } from './Badge'
import { Button } from './Button'
import { Stack } from './Stack'

const meta = {
  title: 'Pack/Stack',
  component: Stack,
  parameters: {
    docs: {
      description: {
        component:
          'The gap names a token rather than a number, so there is no way to ask for a spacing the system does not have.',
      },
    },
  },
} satisfies Meta<typeof Stack>

export default meta
type Story = StoryObj<typeof meta>

export const Vertical: Story = {
  args: {
    gap: 'stack',
    children: (
      <>
        <Badge>Draft</Badge>
        <Badge tone="success">Merged</Badge>
        <Badge tone="warning">Needs review</Badge>
      </>
    ),
  },
}

export const Horizontal: Story = {
  args: {
    direction: 'horizontal',
    gap: 'inline',
    align: 'center',
    children: (
      <>
        <Button variant="primary">Approve</Button>
        <Button>Request changes</Button>
      </>
    ),
  },
}
