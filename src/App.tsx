import { useMemo, useState } from 'react'
import { Badge } from './components/Badge'
import { Button } from './components/Button'
import { Card } from './components/Card'
import { Input } from './components/Input'
import { type Tab, Tabs } from './components/Tabs'
import { Toast } from './components/Toast'
import { isOn } from './flags'

/**
 * The surface an agent changes.
 *
 * It is small on purpose. What matters is that every visible thing here comes from the pack, so
 * a change that breaks the design system breaks a check rather than a review, and the page
 * shell owns nothing but layout.
 */

type Status = 'ready' | 'building' | 'merged'

interface Request {
  id: string
  frame: string
  page: string
  status: Status
  pull?: number
  checks?: string
}

const REQUESTS: Request[] = [
  { id: '1', frame: 'Empty state', page: 'Requests', status: 'ready' },
  { id: '2', frame: 'Filter bar', page: 'Requests', status: 'ready' },
  {
    id: '3',
    frame: 'Request row',
    page: 'Requests',
    status: 'building',
    pull: 14,
    checks: '6 of 8',
  },
  {
    id: '4',
    frame: 'Status badge',
    page: 'Components',
    status: 'merged',
    pull: 11,
    checks: '8 of 8',
  },
]

const TABS: Tab[] = [
  { id: 'ready', label: 'Ready' },
  { id: 'building', label: 'In build' },
  { id: 'merged', label: 'Merged' },
]

const TONE = {
  ready: 'neutral',
  building: 'warning',
  merged: 'success',
} as const

const WORD = {
  ready: 'Ready for development',
  building: 'In build',
  merged: 'Merged behind a flag',
} as const

export function App() {
  const [tab, setTab] = useState<Status>('ready')
  const [query, setQuery] = useState('')
  const [dismissed, setDismissed] = useState(false)

  const shown = useMemo(() => {
    const needle = query.trim().toLowerCase()
    return REQUESTS.filter(
      (r) => r.status === tab && (needle === '' || r.frame.toLowerCase().includes(needle)),
    )
  }, [tab, query])

  return (
    <main className="app">
      <header className="app__header">
        <div>
          <h1 className="app__title">Design requests</h1>
          <p className="app__subtitle">
            Frames marked ready for development, and what happened next.
          </p>
        </div>
        <Button variant="primary">Open the Figma file</Button>
      </header>

      {!dismissed ? (
        <Toast tone="success" onDismiss={() => setDismissed(true)}>
          Pull request 14 is open and pinned to the frame it came from.
        </Toast>
      ) : null}

      <Tabs tabs={TABS} selected={tab} onSelect={(id) => setTab(id as Status)}>
        <div className="app__list-wrap">
          {isOn('sample-feature') ? (
            <Input
              label="Find a frame"
              type="search"
              placeholder="Empty state"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
          ) : null}

          {shown.length === 0 ? (
            <p className="app__empty">
              Nothing here yet. A frame arrives when a designer marks it ready.
            </p>
          ) : (
            <ul className="app__list">
              {shown.map((request) => (
                <li key={request.id}>
                  <Card title={request.frame}>
                    <div className="app__meta">
                      <Badge tone={TONE[request.status]}>{WORD[request.status]}</Badge>
                      <span>on the {request.page} page</span>
                      {request.pull ? (
                        <span className="app__figure">pull request {request.pull}</span>
                      ) : null}
                      {request.checks ? (
                        <span className="app__figure">{request.checks} checks passed</span>
                      ) : null}
                    </div>
                  </Card>
                </li>
              ))}
            </ul>
          )}
        </div>
      </Tabs>
    </main>
  )
}
