import { Badge, type BadgeTone } from './Badge'
import './RecordRow.css'

export interface RecordRowProps {
  label: string
  value: string
  /** The word for the standing. Omitted means there is no standing to report, not "neutral". */
  standing?: string
  tone?: BadgeTone
}

/**
 * One line of a record: what it is, how it is doing, and the figure.
 *
 * Built from Badge rather than from a coloured dot of its own, which is the point of a composite
 * living in the pack at all. A row that invented its own way of saying "needs review" would be a
 * second vocabulary for the same idea, and nobody would know which one was current.
 */
export function RecordRow({ label, value, standing, tone = 'neutral' }: RecordRowProps) {
  return (
    <div className="ds-record">
      <span className="ds-record__label">{label}</span>
      {standing ? <Badge tone={tone}>{standing}</Badge> : null}
      <span className="ds-record__value">{value}</span>
    </div>
  )
}
