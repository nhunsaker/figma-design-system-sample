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

if (!['status', 'reset', 'webhook'].includes(command)) {
  console.error('usage: node scripts/demo.mjs status | reset [--webhook] [--dry-run]')
  console.error('       node scripts/demo.mjs webhook list | register <url> | delete <id|all>')
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

// ─── the webhook ────────────────────────────────────────────────────────────
//
// This exists because the alternative was a curl command in the runbook with a placeholder in
// it, and a command that can be pasted verbatim will be pasted verbatim. One was registered
// against the literal address "YOUR-ADDRESS" within a day of that runbook being written.
//
// Posting to Figma's webhook endpoint creates a webhook. There is no dry run and no validation
// on their side, so the validation is here: the address has to be a real https host, and the
// bridge has to actually answer at it before anything is registered.

if (command === 'webhook') {
  const action = process.argv[3] ?? 'list'
  const hooks = (await figma(`/v2/webhooks?context=file&context_id=${fileKey}`)).webhooks ?? []

  if (action === 'list') {
    if (hooks.length === 0) console.log('\nNo webhooks on this file.')
    for (const hook of hooks) {
      console.log(`\n  ${hook.id}  ${hook.event_type}  ${hook.status}\n  ${hook.endpoint}`)
    }
    process.exit(0)
  }

  if (action === 'delete') {
    const target = process.argv[4]
    if (!target) {
      console.error('which one? node scripts/demo.mjs webhook delete <id|all>')
      process.exit(2)
    }
    const doomed = target === 'all' ? hooks : hooks.filter((h) => String(h.id) === target)
    if (doomed.length === 0) {
      console.error(`no webhook ${target} on this file. "webhook list" shows what is there.`)
      process.exit(2)
    }
    for (const hook of doomed) {
      await figma(`/v2/webhooks/${hook.id}`, { method: 'DELETE' })
      console.log(`deleted ${hook.id}  ${hook.endpoint}`)
    }
    process.exit(0)
  }

  if (action !== 'register') {
    console.error('usage: node scripts/demo.mjs webhook list | register <url> | delete <id|all>')
    process.exit(2)
  }

  const endpoint = process.argv[4]
  if (!endpoint) {
    console.error('node scripts/demo.mjs webhook register https://your-tunnel/figma/webhook')
    process.exit(2)
  }

  let url
  try {
    url = new URL(endpoint)
  } catch {
    console.error(`${endpoint} is not a URL.`)
    process.exit(2)
  }
  if (url.protocol !== 'https:') {
    console.error('Figma only calls https endpoints.')
    process.exit(2)
  }
  if (!url.hostname.includes('.') || /[A-Z_]/.test(url.hostname)) {
    console.error(`${url.hostname} does not look like a real host. Did a placeholder survive?`)
    process.exit(2)
  }
  if (!url.pathname.endsWith('/figma/webhook')) {
    console.error(`the bridge listens on /figma/webhook, not ${url.pathname}.`)
    process.exit(2)
  }

  // The guard that matters: talk to the bridge before telling Figma it exists.
  const health = new URL('/health', url).toString()
  let reachable
  try {
    const response = await fetch(health, { signal: AbortSignal.timeout(8000) })
    reachable = response.ok ? await response.json() : null
  } catch (e) {
    reachable = null
  }
  if (!reachable?.ok) {
    console.error(`nothing answered at ${health}.`)
    console.error('Start the bridge and the tunnel first. Registering a webhook to an address')
    console.error('that does not answer leaves a dead webhook Figma keeps retrying.')
    process.exit(1)
  }
  if (reachable.file !== fileKey) {
    console.error(`that bridge serves ${reachable.file}, not ${fileKey}.`)
    process.exit(1)
  }

  const already = hooks.find((h) => h.endpoint === endpoint)
  if (already) {
    console.log(`already registered as ${already.id}. Nothing to do.`)
    process.exit(0)
  }
  if (hooks.length > 0) {
    console.error(`this file already has ${hooks.length} webhook(s). Delete them first:`)
    for (const hook of hooks) console.error(`  ${hook.id}  ${hook.endpoint}`)
    console.error('  node scripts/demo.mjs webhook delete all')
    process.exit(1)
  }

  const passcode = execFileSync(
    'security',
    [
      'find-generic-password',
      '-a',
      process.env.USER ?? '',
      '-s',
      'figma-bridge-webhook-passcode',
      '-w',
    ],
    { encoding: 'utf8' },
  ).trim()

  const created = await figma('/v2/webhooks', {
    method: 'POST',
    body: JSON.stringify({
      event_type: 'DEV_MODE_STATUS_UPDATE',
      context: 'file',
      context_id: fileKey,
      endpoint,
      passcode,
    }),
  })
  console.log(`registered ${created.id} for ${fileKey}`)
  console.log('Figma sends a PING immediately. The bridge log should show it.')
  process.exit(0)
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
