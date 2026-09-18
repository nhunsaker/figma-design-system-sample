/**
 * Merging is not releasing. Every change an agent lands arrives here with its flag off, in every
 * environment, so a merge moves code without shipping a feature. Turning a flag on is a separate
 * and deliberate act by a person, outside this pipeline.
 *
 * A flag is read from the query string, so a reviewer can turn a single feature on in one browser
 * without turning it on for anyone else.
 */
export const flags = {
  /** The weak spot callout on the drills record. Off until a person says otherwise. */
  'weak-spot': false,
  /** The roll history section on requests. Off until a person says otherwise. */
  'roll-history': false,
} as const

export type FlagName = keyof typeof flags

export function isOn(name: FlagName, search = globalThis.location?.search ?? ''): boolean {
  const params = new URLSearchParams(search)
  const override = params.get(name)
  if (override === 'true') return true
  if (override === 'false') return false
  return flags[name]
}
