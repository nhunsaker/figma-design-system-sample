import { useMemo, useState } from 'react'
import { Badge } from './components/Badge'
import { Button } from './components/Button'
import { Card } from './components/Card'
import { Meter } from './components/Meter'
import { RecordRow } from './components/RecordRow'
import { Stack } from './components/Stack'
import { Stat } from './components/Stat'
import { type Tab, Tabs } from './components/Tabs'
import { Toast } from './components/Toast'
import { isOn } from './flags'

/**
 * A player's record in a poker practice app: what they have played, how it went, and where they
 * are weakest.
 *
 * Every visible thing here comes from the pack, so a change that breaks the design system breaks
 * a check rather than a review. The page shell owns the page frame and nothing else, because
 * spacing comes from Stack.
 *
 * The figures are example data and say so. A screen that opens empty shows nothing about what it
 * does, and a screen that opens with invented figures presented as real is worse than either.
 */

const PROFILE = {
  name: 'Example player',
  rank: 'Rounder',
  peakRoll: '$12,480',
  hands: '1,284',
  winRate: '42%',
  biggestPot: '$2,140',
  sessions: '96',
}

const STYLE = [
  { label: 'Aggression', value: 68, tone: 'neutral' as const },
  { label: 'Showdowns won', value: 62, tone: 'success' as const },
  { label: 'Position awareness', value: 34, tone: 'warning' as const },
]

const DRILLS = [
  { label: 'Starting hands', value: '96', standing: 'Best', tone: 'success' as const },
  { label: 'Pot odds', value: '84' },
  { label: 'Bet sizing', value: '71' },
  { label: 'Position', value: '31', standing: 'Weak spot', tone: 'warning' as const },
]

const VENUES = [
  { label: 'The Kitchen Table', value: '48' },
  { label: 'Riverboat', value: '31' },
  { label: 'The Back Room', value: '17' },
]

const TABS: Tab[] = [
  { id: 'overview', label: 'Overview' },
  { id: 'drills', label: 'Drills' },
  { id: 'venues', label: 'Venues' },
]

export function App() {
  const [tab, setTab] = useState('overview')
  const [dismissed, setDismissed] = useState(false)

  const weakest = useMemo(() => DRILLS.find((d) => d.standing === 'Weak spot'), [])
  const showWeakSpot = isOn('weak-spot') && weakest

  return (
    <main className="app">
      <Stack direction="horizontal" gap="gutter" align="baseline" wrap>
        <Stack gap="inline">
          <h1 className="app__title">{PROFILE.name}</h1>
          <Badge>{PROFILE.rank}</Badge>
        </Stack>
        <Stat label="Peak roll" value={PROFILE.peakRoll} size="large" />
      </Stack>

      {!dismissed ? (
        <Toast onDismiss={() => setDismissed(true)}>
          These are example figures, not a real record.
        </Toast>
      ) : null}

      <Tabs tabs={TABS} selected={tab} onSelect={setTab}>
        {tab === 'overview' ? (
          <Stack gap="gutter">
            <Stack direction="horizontal" gap="gutter" wrap>
              <Stat label="Hands played" value={PROFILE.hands} />
              <Stat
                label="Win rate"
                value={PROFILE.winRate}
                hint={`Across ${PROFILE.hands} hands`}
              />
              <Stat label="Biggest pot" value={PROFILE.biggestPot} />
              <Stat label="Sessions" value={PROFILE.sessions} />
            </Stack>
            <Card title="How you play">
              <Stack gap="stack">
                {STYLE.map((row) => (
                  <Meter key={row.label} label={row.label} value={row.value} tone={row.tone} />
                ))}
              </Stack>
            </Card>
          </Stack>
        ) : null}

        {tab === 'drills' ? (
          <Stack gap="gutter">
            {showWeakSpot ? (
              <Card
                title="Your weak spot"
                footer={<Button variant="primary">Practise position</Button>}
              >
                <p>
                  {weakest.label} is your lowest drill at {weakest.value} out of 100. Ten minutes
                  here is worth an hour anywhere else on this list.
                </p>
              </Card>
            ) : null}
            <Card title="Drills">
              <div>
                {DRILLS.map((row) => (
                  <RecordRow key={row.label} {...row} />
                ))}
              </div>
            </Card>
          </Stack>
        ) : null}

        {tab === 'venues' ? (
          <Card title="Venues">
            <div>
              {VENUES.map((row) => (
                <RecordRow key={row.label} {...row} />
              ))}
            </div>
          </Card>
        ) : null}
      </Tabs>
    </main>
  )
}
