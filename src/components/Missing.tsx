import type { CSSProperties } from 'react'
import './Missing.css'

export interface MissingProps {
  /** The component the design asked for, exactly as the design file names it. */
  name: string
  /** The width the design gave it, in pixels, when the frame reader could measure one. */
  width?: number
  /** The height the design gave it, in pixels, when the frame reader could measure one. */
  height?: number
}

/**
 * A component the design asked for that the pack cannot build.
 *
 * The frame reader reports any instance its key map cannot place. That is not the same as
 * "a new component is needed": it is equally a new variant of something the pack already has, an
 * instance from another library, or a rename that changed the key. This component asserts none of
 * that. It says only that something was here and could not be built, which is true in every one of
 * those cases, and it is why no classifier is needed.
 *
 * It exists so a refusal is visible. Without it, a component the system honestly declined to guess
 * at and a component somebody forgot look identical in the built page.
 *
 * IT MUST LOOK LIKE A GAP. A placeholder that looks finished is a placeholder that ships, so this
 * is deliberately plain and deliberately labelled.
 */
export function Missing({ name, width, height }: MissingProps) {
  // The size is data, not a design decision. It is a measurement handed over from the design file,
  // so it arrives as a value rather than a token, and the stylesheet falls back to a token when
  // the reader could not measure one. Every colour, space and radius here is still a token.
  const reserved = {
    ...(width ? { '--frame-w': `${width}px` } : {}),
    ...(height ? { '--frame-h': `${height}px` } : {}),
  } as CSSProperties

  return (
    <div className="ds-missing" style={reserved} role="note" aria-label={`${name}, not built`}>
      <span className="ds-missing__name">{name}</span>
      <span className="ds-missing__note">not in the design pack, so it was not built</span>
    </div>
  )
}
