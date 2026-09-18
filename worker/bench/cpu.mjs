/**
 * What does one webhook actually cost in CPU?
 *
 * The free plan allows 10ms of CPU per invocation, and CPU is the only limit here that could
 * plausibly bite: waiting on Figma and GitHub does not count against it. So the question is how
 * much compute a frame costs, and how large a frame would have to be before it mattered.
 *
 * This drives the REAL `readFrame` and `bodyFor` against synthetic frames of growing size, so
 * the answer is about the shipped code rather than a reimplementation of it that would drift.
 *
 * IT MEASURES IN NODE, NOT IN WORKERD, and that is a deliberate compromise worth stating.
 * workerd coarsens its timers on purpose, as a side channel defence, so a Worker cannot
 * usefully time itself. Same V8 underneath, so this is a proxy and not a promise. The number
 * Cloudflare reports per invocation in its dashboard is the authority, and after a real run
 * that is the one to read.
 *
 *     pnpm --filter figma-bridge-worker bench
 */
import { FigmaClient } from '../.bench/figma.js'
import { bodyFor, titleFor } from '../.bench/issue.js'

const KEY = 'abc123buttonkey'
const CEILING_MS = 10

/** A frame with `rows` instance-and-label pairs and one nested group `depth` levels deep. */
function frameOf(rows, depth) {
  let id = 0
  const group = (d) => ({
    id: `1:${id++}`,
    name: `Group ${id}`,
    type: 'FRAME',
    children: d > 0 ? [group(d - 1), group(d - 1), group(d - 1)] : [],
  })
  const children = []
  for (let i = 0; i < rows; i++) {
    children.push({ id: `2:${i}`, name: 'Button', type: 'INSTANCE', componentId: 'c1' })
    children.push({
      id: `3:${i}`,
      name: 'Label',
      type: 'TEXT',
      characters: `Row ${i} of the table`,
    })
  }
  children.push(group(depth))
  return { id: '41:207', name: 'Big frame', type: 'FRAME', children }
}

const countNodes = (node) =>
  1 + (node.children ?? []).reduce((total, child) => total + countNodes(child), 0)

async function measure(rows, depth) {
  const document = frameOf(rows, depth)
  const nodes = {
    name: 'Sample',
    nodes: { '41:207': { document, components: { c1: { key: KEY, name: 'Button' } } } },
  }
  const shallow = { document: { children: [{ name: 'Screens', children: [{ id: '41:207' }] }] } }
  const payload = JSON.stringify(nodes)

  // A real request pays for the parse, so the fetcher hands back text each time rather than a
  // parsed object that would let the benchmark skip the most expensive part.
  const fetcher = async (url) =>
    new Response(url.includes('/nodes') ? payload : JSON.stringify(shallow), {
      headers: { 'Content-Type': 'application/json' },
    })

  const figma = new FigmaClient('token', fetcher)
  const map = { [KEY]: 'Button' }

  const once = async () => {
    const frame = await figma.readFrame('AbC123', '41:207', map)
    titleFor(frame)
    bodyFor(frame, null, 'design-pack@1')
  }

  for (let i = 0; i < 50; i++) await once() // let the compiler warm up
  const started = performance.now()
  const runs = 200
  for (let i = 0; i < runs; i++) await once()

  return {
    nodes: countNodes(document),
    kb: payload.length / 1024,
    ms: (performance.now() - started) / runs,
  }
}

console.log('One webhook, end to end through the real reader and the real issue builder.')
console.log('Node as a proxy for workerd. Cloudflare’s dashboard is the authority.\n')
console.log('   nodes    payload     ms/request    share of the 10ms ceiling')
console.log('  ' + '-'.repeat(62))

let worst = null
for (const [rows, depth] of [
  [4, 2],
  [40, 4],
  [200, 6],
  [1000, 7],
]) {
  const r = await measure(rows, depth)
  const share = (r.ms / CEILING_MS) * 100
  console.log(
    `  ${String(r.nodes).padStart(6)}  ${`${r.kb.toFixed(0)} KB`.padStart(9)}  ${r.ms.toFixed(3).padStart(11)}  ${`${share.toFixed(1)}%`.padStart(24)}`,
  )
  worst = r
}

const headroom = Math.round((CEILING_MS / worst.ms) * worst.nodes)
console.log(`\n  Roughly linear in node count. At this rate the ceiling arrives somewhere around`)
console.log(
  `  ${headroom.toLocaleString('en-US')} nodes in one frame, which is not a frame anybody draws.`,
)
