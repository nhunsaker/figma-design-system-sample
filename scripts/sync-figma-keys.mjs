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

const response = await fetch(`https://api.figma.com/v1/files/${fileKey}/components`, {
  headers: { 'X-Figma-Token': token },
})
if (!response.ok) {
  console.error(`Figma said ${response.status}. Is the file key right, and is it published?`)
  process.exit(2)
}

const { meta } = await response.json()
const published = new Map((meta?.components ?? []).map((c) => [c.name, c.key]))

const pack = JSON.parse(readFileSync(join(ROOT, 'design-system', 'pack.meta.json'), 'utf8'))
const components = {}
const missing = []
for (const component of pack.components) {
  const key = published.get(component.figma ?? component.name)
  if (key) components[component.name] = key
  else missing.push(component.name)
}

const existing = JSON.parse(readFileSync(OUT, 'utf8'))
writeFileSync(OUT, `${JSON.stringify({ ...existing, file_key: fileKey, components }, null, 2)}\n`)

console.log(`mapped ${Object.keys(components).length} of ${pack.components.length} components`)
if (missing.length) {
  console.log(`not published in that file yet: ${missing.join(', ')}`)
  console.log('Publish them as a library, or check the name in pack.meta.json matches Figma.')
}
console.log('Run `pnpm pack` to carry the keys into pack.json, then commit both.')
