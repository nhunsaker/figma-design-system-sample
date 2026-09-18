import type { Meta, StoryObj } from '@storybook/react-vite'
import { Badge } from './Badge'
import { Button } from './Button'
import { Card } from './Card'

const meta = {
  title: 'Pack/Card',
  component: Card,
  parameters: {
    docs: {
      description: {
        component:
          'One card, one subject. Cards do not nest, because a card inside a card is a layout asking to be a list.',
      },
    },
  },
} satisfies Meta<typeof Card>

export default meta
type Story = StoryObj<typeof meta>

export const Plain: Story = {
  args: {
    title: 'Ready for development',
    children: <p>Two frames on the Requests page are marked ready and waiting for a build.</p>,
  },
}

export const WithFooter: Story = {
  args: {
    title: 'Pull request 14',
    children: (
      <>
        <p>Adds the empty state to the requests list, behind a flag that is off.</p>
        <Badge tone="success">Checks passed</Badge>
      </>
    ),
    footer: (
      <>
        <Button variant="primary">Approve</Button>
        <Button>Request changes</Button>
      </>
    ),
  },
}
