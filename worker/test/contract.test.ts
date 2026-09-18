/**
 * Hold the Worker to contract/, the same spec the Python service is held to.
 *
 * Fake networks, real handler. Every test drives the actual `handle` function with the actual
 * clients and replaces only `fetch` underneath them. Mocking the clients instead would test the
 * mocks: the parts most likely to be wrong are the request shapes and the branching, and those
 * only get exercised if the code really builds a request and really reads a response.
 */
import { describe, expect, it } from 'vitest'

import cases from '../../contract/cases.json'
import fileShallow from '../../contract/fixtures/file-shallow.json'
import frameNodes from '../../contract/fixtures/frame-nodes.json'
import goldenMapped from '../../contract/golden/issue-mapped.md?raw'
import goldenUnmapped from '../../contract/golden/issue-unmapped.md?raw'
import packJson from '../../design-system/pack.json'
import { FigmaClient } from '../src/figma'
import figmaSource from '../src/figma.ts?raw'
import { GitHubClient } from '../src/github'
import githubSource from '../src/github.ts?raw'
import { codeConnectMap, type Deps, handle, nodeIdFrom } from '../src/index'
import { bodyFor, titleFor } from '../src/issue'
import { NotFromActions, type Verifier } from '../src/oidc'

const WORLD = cases.world
const ENV = {
  FIGMA_FILE_KEY: WORLD.file_key,
  GITHUB_REPO: WORLD.repo,
  FIGMA_TOKEN: 'figma-token',
  GITHUB_TOKEN: 'gh-token',
  WEBHOOK_PASSCODE: WORLD.passcode,
}

/** Name an outbound call the way contract/cases.json names it, or null if it changes nothing. */
function writeKind(method: string, url: string): string | null {
  if (!['POST', 'PATCH', 'PUT', 'DELETE'].includes(method)) return null
  const path = url.split('?')[0]
  if (path.endsWith('/graphql')) return 'github.graphql'
  if (path.includes('/dev_resources')) return 'figma.devresource'
  if (path.includes('api.figma.com') && path.endsWith('/comments')) return 'figma.comment'
  if (path.endsWith('/comments')) return 'github.issue.comment'
  if (path.endsWith('/issues')) return 'github.issue.create'
  return null
}

interface World {
  deps: Deps
  kinds(): string[]
  issues: { number: number; marker: string; body: string; labels: string[] }[]
  clear(): void
}

/** One fake internet, shared by the Figma and GitHub clients so writes land in one recorder. */
function makeWorld({ copilot = true } = {}): World {
  const calls: [string, string][] = []
  const issues: World['issues'] = []
  let next = 14

  const fetcher = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === 'string' ? input : input.toString()
    const method = init?.method ?? 'GET'
    calls.push([method, url])
    const path = new URL(url).pathname
    const body = init?.body ? JSON.parse(String(init.body)) : {}

    // ── Figma ──
    if (url.includes('api.figma.com')) {
      if (path.endsWith('/nodes')) return Response.json(frameNodes)
      if (path.startsWith('/v1/images/')) {
        return Response.json({ images: { [WORLD.node_id]: 'https://figma-alpha.example/x.png' } })
      }
      if (path === '/v1/dev_resources') return Response.json({ links_created: [{ id: 'dr-1' }] })
      if (path.endsWith('/comments')) return Response.json({ id: 'comment-1' })
      if (path.startsWith('/v1/files/')) return Response.json(fileShallow)
      return Response.json({ err: path }, { status: 404 })
    }

    // ── GitHub ──
    if (path === '/search/issues') {
      const needle = new URL(url).searchParams.get('q') ?? ''
      const found = issues.filter((i) => needle.includes(i.marker))
      return Response.json({
        items: found.map((i) => ({ number: i.number, html_url: `https://example/${i.number}` })),
      })
    }
    if (path.endsWith('/issues') && method === 'POST') {
      const number = next++
      issues.push({
        number,
        marker: String(body.body).split('\n')[0],
        body: body.body,
        labels: body.labels,
      })
      return Response.json({ number, html_url: `https://example/${number}` }, { status: 201 })
    }
    if (path.endsWith('/comments') && method === 'POST')
      return Response.json({ id: 1 }, { status: 201 })
    if (path === '/graphql') {
      if (String(body.query).includes('suggestedActors')) {
        return Response.json({
          data: {
            repository: {
              issue: { id: 'ISSUE_1' },
              suggestedActors: {
                nodes: copilot
                  ? [{ login: 'copilot-swe-agent', __typename: 'Bot', id: 'BOT_1' }]
                  : [],
              },
            },
          },
        })
      }
      return Response.json({ data: { replaceActorsForAssignable: {} } })
    }
    return Response.json({ path }, { status: 404 })
  }) as typeof fetch

  const verifier: Verifier = {
    async verify(authorization) {
      if (authorization === 'Bearer good-token') return { repository: WORLD.repo }
      throw new NotFromActions('no')
    },
  }

  return {
    deps: {
      figma: new FigmaClient('figma-token', fetcher),
      github: new GitHubClient('gh-token', WORLD.repo, fetcher),
      verifier,
    },
    kinds: () =>
      [...new Set(calls.map(([m, u]) => writeKind(m, u)).filter(Boolean))].sort() as string[],
    issues,
    clear: () => {
      calls.length = 0
    },
  }
}

const post = (path: string, body: unknown, headers: Record<string, string> = {}) =>
  new Request(`https://bridge.example${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify(body),
  })

// ─── the behaviour table ────────────────────────────────────────────────────

describe('the webhook door, against contract/cases.json', () => {
  for (const testCase of cases.webhook) {
    it(testCase.name, async () => {
      const world = makeWorld()

      // A redelivery only means anything after the first delivery, so replay that one and then
      // forget what it wrote.
      if ('repeat_of' in testCase && testCase.repeat_of) {
        const first = cases.webhook.find((c) => c.name === testCase.repeat_of)
        await handle(post('/figma/webhook', first?.payload), ENV, world.deps)
        world.clear()
      }

      const response = await handle(post('/figma/webhook', testCase.payload), ENV, world.deps)
      const expect_ = testCase.expect as Record<string, unknown>

      expect(response.status, testCase.name).toBe(expect_.status)
      expect(world.kinds(), testCase.name).toEqual(expect_.writes)
      expect(world.issues.length, testCase.name).toBe(expect_.issues_after)
      if ('created' in expect_) {
        expect((await response.json<{ created: boolean }>()).created).toBe(expect_.created)
      }
    })
  }
})

describe('the write back door, against contract/cases.json', () => {
  for (const testCase of cases.writeback) {
    it(testCase.name, async () => {
      const world = makeWorld()
      const headers: Record<string, string> = testCase.signed
        ? { Authorization: 'Bearer good-token' }
        : {}
      const response = await handle(
        post('/github/pull-request', testCase.payload, headers),
        ENV,
        world.deps,
      )
      const expect_ = testCase.expect as Record<string, unknown>

      expect(response.status, testCase.name).toBe(expect_.status)
      expect(world.kinds(), testCase.name).toEqual(expect_.writes)
      if (expect_.wrote) {
        expect((await response.json<{ what: string }>()).what).toBe(expect_.wrote)
      } else if (expect_.status === 200) {
        expect((await response.json<{ wrote: boolean }>()).wrote).toBe(false)
      }
    })
  }
})

// ─── the words the agent reads ──────────────────────────────────────────────

describe('the issue body, against contract/golden/', () => {
  async function build(mapped: boolean) {
    const world = makeWorld()
    const pack = structuredClone(packJson) as {
      id?: string
      components?: { name: string; figma_keys?: string[] }[]
    }
    if (mapped) {
      for (const component of pack.components ?? []) {
        if (component.name === 'Button') component.figma_keys = ['abc123buttonkey']
      }
    }
    const [mapping, packId] = codeConnectMap(pack)
    const figma = world.deps.figma as FigmaClient
    const frame = await figma.readFrame(WORLD.file_key, WORLD.node_id, mapping)
    return `# ${titleFor(frame)}\n\n${bodyFor(frame, null, packId)}`
  }

  it('matches byte for byte when nothing is mapped', async () => {
    expect(await build(false)).toBe(goldenUnmapped)
  })

  it('matches byte for byte when a component is mapped', async () => {
    expect(await build(true)).toBe(goldenMapped)
  })

  it('names what it could not match rather than guessing', async () => {
    const body = await build(false)
    expect(body).toContain('not mapped to a pack component')
    expect(body).toContain('Do not guess which component was meant')
  })
})

// ─── the small pieces ───────────────────────────────────────────────────────

describe('nodeIdFrom', () => {
  for (const text of [
    'https://www.figma.com/design/AbC123/Sample?node-id=41-207',
    '[frame](https://figma.com/design/AbC123/Sample?node-id=41-207)',
    'see https://www.figma.com/design/AbC123/Sample?m=auto&node-id=41-207&t=x',
  ]) {
    it(`reads the api form out of ${text.slice(0, 32)}...`, () => {
      expect(nodeIdFrom(text)).toBe('41:207')
    })
  }

  for (const text of [
    'no link here',
    'https://www.figma.com/design/AbC123/Sample',
    'https://example.com?node-id=1-2',
  ]) {
    it(`gives nothing for ${text.slice(0, 32)}`, () => {
      expect(nodeIdFrom(text)).toBeNull()
    })
  }
})

describe('health', () => {
  it('says which file and repository this Worker serves', async () => {
    const response = await handle(
      new Request('https://bridge.example/health'),
      ENV,
      makeWorld().deps,
    )
    expect(await response.json()).toEqual({
      ok: true,
      file: WORLD.file_key,
      repo: WORLD.repo,
    })
  })
})

describe('the issue still opens when the coding agent is unavailable', () => {
  it('comments instead of failing the delivery', async () => {
    const world = makeWorld({ copilot: false })
    const ready = cases.webhook[0]
    const response = await handle(post('/figma/webhook', ready.payload), ENV, world.deps)
    expect(response.status).toBe(200)
    expect((await response.json<{ assigned: boolean }>()).assigned).toBe(false)
    expect(world.issues.length).toBe(1)
  })
})

// ─── the default fetcher, which no runtime test can reach ───────────────────

describe('no client defaults its fetcher to the bare global', () => {
  /**
   * This is a source check, and it is a source check on purpose.
   *
   * `private readonly fetcher: typeof fetch = fetch` stores the global and then calls it as
   * `this.fetcher(...)`, so `fetch` receives the client as its `this`. Node tolerates that.
   * The real edge throws "Illegal invocation" and returns 500. A green suite shipped exactly that,
   * and Figma's first real webhook got a 500.
   *
   * It cannot be caught by running anything here. A stubbed fetch is a plain function and ignores
   * its receiver, so it never reproduces. The native one cannot reach the network in this runtime,
   * so it fails as "internal error" before the receiver check would ever show. Both green, both
   * useless. Measured, not assumed.
   *
   * So the rule is enforced where it is visible: the text of the source. Wrap it in an arrow and
   * the call is a plain global call again.
   */
  for (const [name, source] of [
    ['github.ts', githubSource],
    ['figma.ts', figmaSource],
  ] as const) {
    it(`${name} wraps its default fetcher`, () => {
      expect(source, `${name} must not default its fetcher to the bare global`).not.toMatch(
        /:\s*typeof fetch\s*=\s*fetch\s*[,)]/,
      )
    })
  }
})
