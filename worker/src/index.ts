/**
 * The bridge, as a Cloudflare Worker.
 *
 * A port of bridge/src/bridge/app.py. Two doors, and both are shut by default.
 *
 * `POST /figma/webhook` is Figma saying a frame changed dev status. Authenticated by a passcode
 * this service chose and handed to Figma when the webhook was registered.
 *
 * `POST /github/pull-request` is our own Actions run saying what happened to a pull request.
 * Authenticated by a GitHub OIDC token verified against GitHub's published keys.
 *
 * Everything else is refused. No route takes a file key from the caller: this Worker serves
 * exactly one Figma file, named in its own configuration, so a stolen passcode still cannot be
 * used to read somebody else's design.
 *
 * ONE DIFFERENCE FROM THE HOSTED BRIDGE, and it is not cosmetic. The Python service reads
 * design-system/pack.json from disk on every request, so a changed pack is live on the next one.
 * A Worker has no filesystem, so the pack is bundled at build time and a changed pack needs a
 * redeploy. That is the trade for having nothing to operate, and worker/README.md says so.
 */
import packJson from '../../design-system/pack.json'
import { constantTimeEqual, type Env, requireEnv } from './env'
import { FigmaClient } from './figma'
import { GitHubClient } from './github'
import { bodyFor, markerFor, titleFor } from './issue'
import { ActionsVerifier, type Verifier } from './oidc'

const READY = 'READY_FOR_DEV'
const LABEL = 'design:ready'

interface PackComponent {
  name: string
  figma_keys?: string[]
}

/**
 * Figma component key to pack component name, plus the pack's id.
 *
 * The mapping lives in the pack, written there by the key sync, so this has no second copy of it
 * to keep in step.
 */
export function codeConnectMap(pack: {
  id?: string
  components?: PackComponent[]
}): [Record<string, string>, string] {
  const mapping: Record<string, string> = {}
  for (const component of pack.components ?? []) {
    for (const key of component.figma_keys ?? []) mapping[key] = component.name
  }
  return [mapping, pack.id ?? '']
}

const NODE_ID = /figma\.com\/(?:design|file)\/[A-Za-z0-9]+[^\s)]*?node[-_]id=([0-9]+[-:][0-9]+)/

/**
 * Pull the frame out of a pull request body.
 *
 * Figma writes 41-207 in a link and 41:207 in the API, so this returns the API form.
 */
export function nodeIdFrom(text: string): string | null {
  const match = NODE_ID.exec(text)
  return match ? match[1].replace('-', ':') : null
}

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })

export interface Deps {
  figma?: FigmaClient
  github?: GitHubClient
  verifier?: Verifier
  pack?: { id?: string; components?: PackComponent[] }
}

export async function handle(request: Request, rawEnv: Partial<Env>, deps: Deps = {}) {
  const url = new URL(request.url)
  const env = requireEnv(rawEnv)

  const figma = deps.figma ?? new FigmaClient(env.FIGMA_TOKEN)
  const github = deps.github ?? new GitHubClient(env.GITHUB_TOKEN, env.GITHUB_REPO)
  const verifier = deps.verifier ?? new ActionsVerifier(env.GITHUB_REPO)
  const pack = deps.pack ?? (packJson as { id?: string; components?: PackComponent[] })

  if (request.method === 'GET' && url.pathname === '/health') {
    return json(200, { ok: true, file: env.FIGMA_FILE_KEY, repo: env.GITHUB_REPO })
  }

  if (request.method !== 'POST') return new Response('no', { status: 404 })

  // ── the front door ──────────────────────────────────────────────────────
  if (url.pathname === '/figma/webhook') {
    const payload = (await request.json().catch(() => ({}))) as Record<string, unknown>

    if (!constantTimeEqual(String(payload.passcode ?? ''), env.WEBHOOK_PASSCODE)) {
      console.warn('refused a webhook with a wrong passcode')
      return json(401, { detail: 'no' })
    }

    const event = payload.event_type
    // Figma sends a PING when the webhook is registered, and answering it is what confirms the
    // endpoint is alive. It carries the passcode like everything else.
    if (event === 'PING') return json(200, { ok: true })
    if (event !== 'DEV_MODE_STATUS_UPDATE') return new Response(null, { status: 204 })

    // This Worker serves one file. A payload naming another is not something to reason about,
    // it is something to stop at.
    const fileKey = payload.file_key
    if (fileKey !== env.FIGMA_FILE_KEY) {
      console.warn('refused a webhook for a file this Worker does not serve')
      return json(403, { detail: 'no' })
    }

    const status = String(payload.status ?? payload.dev_status ?? '').toUpperCase()
    const nodeId = String(payload.node_id ?? '')
    if (status !== READY || !nodeId) return new Response(null, { status: 204 })

    const marker = markerFor(env.FIGMA_FILE_KEY, nodeId)
    const existing = await github.findIssueByMarker(marker)
    if (existing) {
      // A redelivery, or a designer toggling the status twice. Answer 200 so Figma stops
      // retrying, and do not open a second issue for the same frame.
      console.info(`frame already has issue ${existing.number}`)
      return json(200, { issue: existing.number, created: false })
    }

    const [mapping, packId] = codeConnectMap(pack)
    const frame = await figma.readFrame(env.FIGMA_FILE_KEY, nodeId, mapping)
    const image = await figma.image(env.FIGMA_FILE_KEY, nodeId)
    const issue = await github.createIssue(titleFor(frame), bodyFor(frame, image, packId), [LABEL])

    const assigned = await github.assignCopilot(issue.number)
    if (!assigned) {
      await github.comment(
        issue.number,
        'The coding agent is not available on this account, so this issue is waiting for a ' +
          'person. Everything it needs is above.',
      )
    }
    await figma.pinDevResource(env.FIGMA_FILE_KEY, nodeId, `Issue ${issue.number}`, issue.url)
    console.info(`opened issue ${issue.number} for node ${nodeId}`)
    return json(200, { issue: issue.number, created: true, assigned })
  }

  // ── the back door, which only our own Actions run may knock on ──────────
  if (url.pathname === '/github/pull-request') {
    try {
      await verifier.verify(request.headers.get('Authorization'))
    } catch (error) {
      console.warn(`refused a write back: ${(error as Error).message}`)
      return json(401, { detail: 'no' })
    }

    const payload = (await request.json().catch(() => ({}))) as Record<string, unknown>
    const nodeId = nodeIdFrom(String(payload.body ?? ''))
    if (!nodeId) {
      // Nothing to write back to, and not an error: a pull request naming no frame is somebody's
      // ordinary change. The contract check is what holds an agent's to a higher standard.
      return json(200, { wrote: false, why: 'the pull request body names no frame' })
    }

    const {
      event,
      number,
      url: prUrl = '',
    } = payload as {
      event?: string
      number?: number
      url?: string
    }

    if (event === 'opened' || event === 'reopened') {
      await figma.pinDevResource(env.FIGMA_FILE_KEY, nodeId, `Pull request ${number}`, prUrl)
      return json(200, { wrote: true, what: 'dev resource' })
    }

    if (event === 'closed') {
      const message = payload.merged
        ? `Built and merged in pull request ${number}. It is behind a flag that is off, so ` +
          `nothing has changed for anyone yet. ${prUrl}`
        : `Pull request ${number} was closed without merging, so this frame has not been ` +
          `built. ${prUrl}`
      await figma.comment(env.FIGMA_FILE_KEY, nodeId, message)
      return json(200, { wrote: true, what: 'comment' })
    }

    return json(200, { wrote: false, why: `nothing to do for ${event}` })
  }

  return new Response('no', { status: 404 })
}

export default {
  fetch(request: Request, env: Env): Promise<Response> {
    return handle(request, env)
  },
}
