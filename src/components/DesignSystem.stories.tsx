import type { Meta, StoryObj } from '@storybook/react-vite'
import { Button } from './Button'
import { DesignSystem } from './DesignSystem'
import { Meter } from './Meter'
import { Stack } from './Stack'
import { Stat } from './Stat'

const meta = {
  title: 'Pack/DesignSystem',
  component: DesignSystem,
  parameters: {
    docs: {
      description: {
        component:
          'The same surface in both brands. One bundle carries every brand and the class picks one, so a brand change is a runtime decision rather than a rebuild.',
      },
    },
  },
} satisfies Meta<typeof DesignSystem>

export default meta
type Story = StoryObj<typeof meta>

const Sample = () => (
  <Stack gap="gutter">
    <Stat label="Peak roll" value="$12,480" size="large" />
    <Meter label="Showdowns won" value={62} tone="success" />
    <Button variant="primary">Publish</Button>
  </Stack>
)

export const Harbor: Story = { args: { brand: 'harbor', children: <Sample /> } }
export const Ember: Story = { args: { brand: 'ember', children: <Sample /> } }
