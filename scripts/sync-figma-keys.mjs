#!/usr/bin/env node
/**
 * Write figma/code-connect.json from the published library.
 *
 * A Figma component key is the stable identity of a component across files and versions. The
 * pack needs it so the bridge can say which pack component a frame is made of, rather than
 * guessing from a layer name that a designer is free to change.
 *
 * This reads. It writes nothing to Figma. The token comes from the Keychain and never from an
 * argument or a file.
 *
 * Usage: FIGMA_FILE_KEY=<key> node scripts/sync-figma-keys.mjs
 */
import { execFileSync } from 'node:child_process'
import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const OUT = join(ROOT, 'figma', 'code-connect.json')

const fileKey = process.env.FIGMA_FILE_KEY
if (!fileKey) {
  console.error('set FIGMA_FILE_KEY to the sample file key. It is in the file URL, after /design/.')
  process.exit(2)
}

const token = execFileSync(
  'security',
  ['find-generic-password', '-a', process.env.USER ?? '', '-s', 'sorb-figma-api-token', '-w'],
  { encoding: 'utf8' },
).trim()

// The file itself, not /components. That endpoint lists only PUBLISHED components, and a
// component does not need publishing to have a stable key or to be usable here. Reading the file
// removes a manual "click Publish" step from the demo, which is one less thing to remember and
// one less thing to get wrong in front of somebody.
const response = await fetch(`https://api.figma.com/v1/files/${fileKey}?depth=3`, {
  headers: { 'X-Figma-Token': token },
})
if (!response.ok) {
  console.error(`Figma said ${response.status}. Is the file key right, and can this token read it?`)
  process.exit(2)
}

const file = await response.json()

/**
 * Every component key, grouped by the name a person sees in the assets panel.
 *
 * A component with variants holds one component per variant, each with its own key and a name
 * like `variant=Primary, size=Compact`. The name a designer gave the thing lives on the parent
 * set. An instance in a frame points at the VARIANT's key, never at the set's, so the map has to
 * carry every variant key or the bridge sees a frame full of components it cannot recognise.
 */
const sets = file.componentSets ?? {}
const byName = new Map()
for (const [nodeId, component] of Object.entries(file.components ?? {})) {
  const name = sets[component.componentSetId]?.name ?? component.name
  if (!component.key) {
    console.error(`component ${name} (${nodeId}) has no key, which should not happen`)
    continue
  }
  if (!byName.has(name)) byName.set(name, [])
  byName.get(name).push(component.key)
}

const pack = JSON.parse(readFileSync(join(ROOT, 'design-system', 'pack.meta.json'), 'utf8'))
const components = {}
const missing = []
for (const component of pack.components) {
  // A component with `figma: null` is structural, not visual. A layout primitive and a provider
  // have no counterpart in a design tool, and listing them as missing would be noise that trains
  // everybody to ignore the one line that matters.
  if (component.figma === null) continue
  const keys = byName.get(component.figma ?? component.name) ?? []
  if (keys.length === 0) {
    missing.push(component.name)
    continue
  }
  for (const key of keys) components[key] = component.name
}

const existing = JSON.parse(readFileSync(OUT, 'utf8'))
writeFileSync(OUT, `${JSON.stringify({ ...existing, file_key: fileKey, components }, null, 2)}\n`)

const named = new Set(Object.values(components))
const visual = pack.components.filter((c) => c.figma !== null).length
console.log(
  `mapped ${named.size} of ${visual} visual components, ` +
    `${Object.keys(components).length} keys including variants`,
)
if (missing.length) {
  console.log(`not in that file yet: ${missing.join(', ')}`)
  console.log('Check the component name in Figma matches the name in pack.meta.json.')
}
console.log('Run `pnpm build:pack` to carry the keys into pack.json, then commit both.')
