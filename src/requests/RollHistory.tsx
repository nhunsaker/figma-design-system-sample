import { Missing } from '../components/Missing'
import { Stack } from '../components/Stack'
import { Stat } from '../components/Stat'

export function RollHistory() {
  return (
    <Stack gap="stack">
      <h2>Roll over the last 90 days</h2>
      <Missing name="Sparkline" width={672} height={80} />
      <Stack direction="horizontal" gap="gutter" fill wrap>
        <Stat label="Peak" value="$12,480" />
        <Stat label="Low" value="$1,205" />
        <Stat label="Now" value="$8,930" />
      </Stack>
    </Stack>
  )
}
