#!/usr/bin/env node
/**
 * Run the demo, then put everything back.
 *
 * A demonstration you can only give once is a demonstration you will get wrong in front of
 * people. This makes the whole loop repeatable: `status` says exactly what state the demo is in
 * right now, and `reset` returns the Figma file and the repository to the state they were in
 * before anyone marked a frame ready.
 *
 * What reset removes, all of it created by a run:
 *   Figma   dev resources pinned to the request frames, and comments the bridge left
 *   GitHub  issues labelled design:ready, the pull requests they produced, and their branches
 *
 * What reset deliberately does NOT touch:
 *   the components, the frames, the variables       the demo itself, not its output
 *   the webhook                                     infrastructure, removed with --webhook
 *   anything merged to main                         history is not demo state
 *
 * The one thing no API can do is set a frame's dev status. Figma's REST surface can read that a
 * frame is ready and cannot mark one anything, which is the right place for that line: a person
 * decides what a design is ready for. So the last step of a reset is two clicks, and this script
 * says so rather than pretending otherwise.
 *
 * Usage:
 *   FIGMA_FILE_KEY=<key> node scripts/demo.mjs status
 *   FIGMA_FILE_KEY=<key> node scripts/demo.mjs reset [--webhook] [--dry-run]
 *
 * GitHub work goes through the `gh` CLI, which is already authenticated for a person running a
 * demo. The bridge's own scoped token stays out of this: an operator script and a service should
 * never share a credential.
 */
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const command = process.argv[2]
const DRY = process.argv.includes('--dry-run')
const WITH_WEBHOOK = process.argv.includes('--webhook')

if (!['status', 'reset'].includes(command)) {
  console.error('usage: node scripts/demo.mjs status | reset [--webhook] [--dry-run]')
  process.exit(2)
}

const pack = JSON.parse(readFileSync(join(ROOT, 'design-system', 'pack.json'), 'utf8'))
const fileKey = process.env.FIGMA_FILE_KEY ?? pack.figma?.file_key
if (!fileKey) {
  console.error('no FIGMA_FILE_KEY, and the pack does not record one. Run pnpm sync:figma first.')
  process.exit(2)
}

const token = execFileSync(
  'security',
  ['find-generic-password', '-a', process.env.USER ?? '', '-s', 'sorb-figma-api-token', '-w'],
  { encoding: 'utf8' },
).trim()

const figma = async (path, init = {}) => {
  const response = await fetch(`https://api.figma.com${path}`, {
    ...init,
    headers: { 'X-Figma-Token': token, 'Content-Type': 'application/json', ...init.headers },
  })
  if (!response.ok) throw new Error(`Figma ${init.method ?? 'GET'} ${path} -> ${response.status}`)
  return response.status === 204 ? {} : response.json()
}

const gh = (args) => {
  try {
    return execFileSync('gh', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim()
  } catch (e) {
    // A repository that does not exist yet is a normal state before the first push, not a crash.
    return null
  }
}

const repo = pack.source?.repository ?? 'nhunsaker/figma-design-system-sample'
const say = (label, value) => console.log(`  ${label.padEnd(26)} ${value}`)

// ─── what is out there now ──────────────────────────────────────────────────

async function collect() {
  const [resources, comments, hooks, file] = await Promise.all([
    figma(`/v1/files/${fileKey}/dev_resources`).catch(() => ({ dev_resources: [] })),
    figma(`/v1/files/${fileKey}/comments`).catch(() => ({ comments: [] })),
    figma(`/v2/webhooks?context=file&context_id=${fileKey}`).catch(() => ({ webhooks: [] })),
    figma(`/v1/files/${fileKey}?depth=2`).catch(() => ({ document: { children: [] } })),
  ])

  const frames = []
  for (const page of file.document?.children ?? []) {
    if (page.name !== 'Requests') continue
    for (const node of page.children ?? []) {
      frames.push({ id: node.id, name: node.name, status: node.devStatus?.type ?? 'none' })
    }
  }

  const issues = JSON.parse(
    gh([
      'issue',
      'list',
      '-R',
      repo,
      '--label',
      'design:ready',
      '--state',
      'open',
      '--json',
      'number,title',
    ]) ?? '[]',
  )
  const pulls = JSON.parse(
    gh(['pr', 'list', '-R', repo, '--state', 'open', '--json', 'number,title,headRefName']) ?? '[]',
  )

  return {
    resources: resources.dev_resources ?? [],
    comments: comments.comments ?? [],
    hooks: hooks.webhooks ?? [],
    frames,
    issues,
    pulls,
  }
}

const state = await collect()

if (command === 'status') {
  console.log(`\nFigma file ${fileKey}`)
  for (const frame of state.frames) say(frame.name, frame.status)
  say('dev resources pinned', state.resources.length)
  say('comments', state.comments.length)
  say('webhooks', state.hooks.length ? state.hooks.map((h) => h.endpoint).join(', ') : 'none')

  console.log(`\nRepository ${repo}`)
  say(
    'open design:ready issues',
    state.issues.length ? state.issues.map((i) => `#${i.number}`).join(' ') : 'none',
  )
  say(
    'open pull requests',
    state.pulls.length ? state.pulls.map((p) => `#${p.number}`).join(' ') : 'none',
  )

  const ready = state.frames.filter((f) => f.status === 'READY_FOR_DEV')
  console.log('')
  if (state.issues.length || state.pulls.length || state.resources.length) {
    console.log('A run is in progress or finished. `reset` puts it back.')
  } else if (ready.length) {
    console.log(
      `${ready.length} frame(s) already marked ready. Move them off Ready before the next run,`,
    )
    console.log('or the status change that starts a run has nowhere to travel from.')
  } else {
    console.log('Clean. Mark a frame ready for development to start a run.')
  }
  process.exit(0)
}

// ─── put it back ────────────────────────────────────────────────────────────

const done = []
const skipped = []

for (const resource of state.resources) {
  if (DRY) {
    skipped.push(`would unpin ${resource.name}`)
    continue
  }
  await figma(`/v1/files/${fileKey}/dev_resources/${resource.id}`, { method: 'DELETE' })
  done.push(`unpinned ${resource.name}`)
}

for (const comment of state.comments) {
  if (DRY) {
    skipped.push(`would delete comment ${comment.id}`)
    continue
  }
  await figma(`/v1/files/${fileKey}/comments/${comment.id}`, { method: 'DELETE' })
  done.push(`deleted comment ${comment.id}`)
}

for (const pull of state.pulls) {
  if (DRY) {
    skipped.push(`would close pull request ${pull.number} and delete ${pull.headRefName}`)
    continue
  }
  gh(['pr', 'close', String(pull.number), '-R', repo, '--delete-branch'])
  done.push(`closed pull request ${pull.number}`)
}

for (const issue of state.issues) {
  if (DRY) {
    skipped.push(`would close issue ${issue.number}`)
    continue
  }
  gh(['issue', 'close', String(issue.number), '-R', repo, '-c', 'Demo reset.'])
  done.push(`closed issue ${issue.number}`)
}

if (WITH_WEBHOOK) {
  for (const hook of state.hooks) {
    if (DRY) {
      skipped.push(`would delete webhook ${hook.id}`)
      continue
    }
    await figma(`/v2/webhooks/${hook.id}`, { method: 'DELETE' })
    done.push(`deleted webhook ${hook.id}`)
  }
}

console.log(DRY ? '\nDry run, nothing changed:' : '\nReset:')
for (const line of [...done, ...skipped]) console.log(`  ${line}`)
if (done.length === 0 && skipped.length === 0) console.log('  nothing to undo')

const ready = state.frames.filter((f) => f.status === 'READY_FOR_DEV')
if (ready.length) {
  console.log('\nOne step no API can do, because Figma does not let one:')
  for (const frame of ready) {
    console.log(
      `  In Dev Mode, set ${frame.name} back to none. Marking it ready again starts the next run.`,
    )
  }
}
