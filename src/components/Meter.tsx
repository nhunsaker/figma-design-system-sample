import { Progress, ProgressBar } from '@metatoy/bootstrap-styled'
import './Meter.css'

export type MeterTone = 'neutral' | 'success' | 'warning' | 'danger'

export interface MeterProps {
  label: string
  /** A percentage, 0 to 100. Anything outside that is clamped rather than drawn wrong. */
  value: number
  tone?: MeterTone
}

const VENDOR_TONE = {
  neutral: 'secondary',
  success: 'success',
  warning: 'warning',
  danger: 'danger',
} as const

/**
 * A proportion, shown as a bar and said as a number.
 *
 * The bar is the quick read and the number is the actual answer. A bar on its own is a shape
 * nobody can quote in a meeting, and it is also the pack's colour-never-alone rule failing
 * quietly: two bars of different lengths in different colours say nothing to a reader who cannot
 * separate the colours.
 */
export function Meter({ label, value, tone = 'neutral' }: MeterProps) {
  const safe = Math.max(0, Math.min(100, Math.round(value)))
  return (
    <div className="ds-meter">
      <div className="ds-meter__head">
        <span className="ds-meter__label">{label}</span>
        <span className="ds-meter__value">{safe}%</span>
      </div>
      {/* The name and the value belong on the element that carries the role. On the wrapper they
          are prohibited attributes, and the bar itself is left an unnamed progressbar. */}
      <Progress className="ds-meter__track">
        <ProgressBar now={safe} variant={VENDOR_TONE[tone]} aria-label={label} />
      </Progress>
    </div>
  )
}
