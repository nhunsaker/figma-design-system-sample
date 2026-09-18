/**
 * Turn a frame into the issue an agent will read.
 *
 * A port of bridge/src/bridge/issue.py, and the one module where "port" means byte for byte. The
 * issue body is the entire contract with the agent, so a word that differs between the two
 * runtimes means the agent is given different instructions depending on which one read the
 * frame. contract/golden/ holds the expected output and both suites diff against it.
 *
 * The agent gets one shot at understanding what was asked for. Everything it needs is here, and
 * nothing it does not: no internal machinery, and no instructions duplicating AGENTS.md, because
 * the agent reads that file anyway and two copies of a rule is one rule that will drift.
 *
 * The one judgement this module makes is to be explicit about what could not be worked out. A
 * frame using a component the key map has not matched produces a line saying exactly that. An
 * agent told the truth vaguely does better work than an agent told a guess confidently.
 */
import { type FrameRead, frameUrl } from './figma'

/** The idempotency key, carried in the issue body so a redelivery finds the first issue. */
export function markerFor(fileKey: string, nodeId: string): string {
  return `<!-- figma-bridge:${fileKey}:${nodeId} -->`
}

export function titleFor(frame: FrameRead): string {
  const where = frame.pageName ? ` on ${frame.pageName}` : ''
  return `Build ${frame.name}${where}`
}

export function bodyFor(frame: FrameRead, imageUrl: string | null, packId: string): string {
  const lines: string[] = [
    markerFor(frame.fileKey, frame.nodeId),
    '',
    `A designer marked **${frame.name}** ready for development.`,
    '',
    `[Open the frame in Figma](${frameUrl(frame.fileKey, frame.nodeId)})`,
    '',
  ]

  if (imageUrl) {
    lines.push(
      `![${frame.name}](${imageUrl})`,
      '',
      '_The image above is a temporary Figma export and will stop loading after a' +
        ' while. The link to the frame is the durable one._',
      '',
    )
  }

  lines.push('## What the frame is made of', '')
  for (const name of frame.components) lines.push(`- \`${name}\` from the design pack`)
  // The em dash below is deliberate and has to match the Python character for character.
  for (const name of frame.unknownComponents) {
    lines.push(`- **${name}** — not mapped to a pack component`)
  }
  if (frame.components.length === 0 && frame.unknownComponents.length === 0) {
    lines.push('- Nothing the bridge could identify. Read the frame before you build.')
  }
  lines.push('')

  if (frame.unknownComponents.length > 0) {
    lines.push(
      '> Some of this frame is not mapped to code. Do not guess which component was meant.',
      '> If the design needs something the pack does not have, say so in the pull request',
      '> under Left undone and build the part you are sure about.',
      '',
    )
  }

  if (frame.text.length > 0) {
    lines.push('## The words in the frame', '', 'Use these exactly. Copy is a design decision.', '')
    for (const line of frame.text) lines.push(`- ${line}`)
    lines.push('')
  }

  lines.push(
    '## Acceptance',
    '',
    '- [ ] The change matches the frame',
    '- [ ] Only components from the design pack are used',
    '- [ ] A story covers the new state',
    '- [ ] `pnpm test:all` passes',
    '- [ ] The change is behind a flag in `src/flags.ts`, set to `false`',
    '',
    '## Before you start',
    '',
    `Read \`design-system/pack.json\` (\`${packId}\`) and \`AGENTS.md\`. The pack is the whole`,
    'vocabulary and the checks enforce it, so building to the pack is faster than building',
    'around it.',
  )
  return lines.join('\n')
}
