import { Card } from '../components/Card'
import { Stack } from '../components/Stack'
import { Stat } from '../components/Stat'

/**
 * The mapped part of the roll history request.
 *
 * The frame also contains a Sparkline, which is not in the pack. This builds the title and the
 * three figures the pack can express, and leaves the chart itself for the left-undone section.
 */
export function RollHistory() {
  return (
    <Card title="Roll over the last 90 days">
      <Stack gap="gutter">
        <Stack direction="horizontal" gap="gutter" fill wrap>
          <Stat label="Peak" value="$12,480" />
          <Stat label="Low" value="$1,205" />
          <Stat label="Now" value="$8,930" />
        </Stack>
        <p>Roll over the last 90 days</p>
      </Stack>
    </Card>
  )
}
