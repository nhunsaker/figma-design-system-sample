import { spawnSync } from 'node:child_process'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { afterEach, describe, expect, it } from 'vitest'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const CHECK = join(ROOT, 'scripts', 'check-pr-contract.mjs')

const temps = []
afterEach(() => {
  while (temps.length) rmSync(temps.pop(), { recursive: true, force: true })
})

const FRAME = 'https://www.figma.com/design/AbC123XyZ/Design-System-Sample?node-id=41-207'

const good = {
  frame: `[Requests / Empty state](${FRAME})`,
  'what changed': 'The requests list now says what to do when it is empty.',
  acceptance: '- [x] Empty list shows one sentence\n- [x] No new components',
  flag: '`weak-spot`',
  'left undone': 'Nothing. The copy came straight from the frame.',
}

const bodyFrom = (sections) =>
  Object.entries(sections)
    .map(([heading, content]) => `## ${heading}\n\n${content}\n`)
    .join('\n')

/** Run the check against a body, with the repository's real src/flags.ts. */
function check(sections, omit = []) {
  const dir = mkdtempSync(join(tmpdir(), 'pr-'))
  temps.push(dir)
  const file = join(dir, 'body.md')
  const copy = { ...sections }
  for (const key of omit) delete copy[key]
  writeFileSync(file, bodyFrom(copy))
  return spawnSync('node', [CHECK, '--body-file', file, '--root', ROOT], { encoding: 'utf8' })
}

describe('check-pr-contract', () => {
  /** Run the check against a body verbatim, rather than one assembled from sections. */
  const checkRaw = (body) => {
    const dir = mkdtempSync(join(tmpdir(), 'pr-'))
    const file = join(dir, 'body.md')
    writeFileSync(file, body)
    const result = spawnSync('node', [CHECK, '--body-file', file, '--root', ROOT], {
      encoding: 'utf8',
    })
    rmSync(dir, { recursive: true, force: true })
    return result
  }

  it('passes a body that fills the contract', () => {
    const result = check(good)
    expect(result.status).toBe(0)
    expect(result.stdout).toContain('ok')
  })

  it.each(['frame', 'what changed', 'acceptance', 'flag', 'left undone'])(
    'refuses a body with no %s section',
    (heading) => {
      const result = check(good, [heading])
      expect(result.status).toBe(1)
      expect(result.stderr).toContain(`no "## ${heading}" section`)
    },
  )

  it('refuses a heading with nothing under it', () => {
    const result = check({ ...good, 'left undone': '' })
    expect(result.status).toBe(1)
    expect(result.stderr).toContain('is empty')
  })

  it('refuses a Left undone that says almost nothing', () => {
    const result = check({ ...good, 'left undone': '-' })
    expect(result.status).toBe(1)
    expect(result.stderr).toContain('says almost nothing')
  })

  it('accepts "nothing" as a Left undone, because sometimes it is true', () => {
    expect(check({ ...good, 'left undone': 'Nothing.' }).status).toBe(0)
  })

  it('refuses a frame section with no Figma link', () => {
    const result = check({ ...good, frame: 'The empty state on the Requests page.' })
    expect(result.status).toBe(1)
    expect(result.stderr).toContain('no Figma link')
  })

  it('refuses a link to the file rather than to the frame', () => {
    const result = check({
      ...good,
      frame: 'https://www.figma.com/design/AbC123XyZ/Design-System-Sample',
    })
    expect(result.status).toBe(1)
    expect(result.stderr).toContain('not a frame')
  })

  it('refuses a flag that does not exist in the code', () => {
    const result = check({ ...good, flag: '`brand-new-flag`' })
    expect(result.status).toBe(1)
    expect(result.stderr).toContain('not in src/flags.ts')
    expect(result.stderr).toContain('weak-spot')
  })

  it('refuses a flag section that names no flag at all', () => {
    const result = check({ ...good, flag: 'behind a flag' })
    expect(result.status).toBe(1)
    expect(result.stderr).toContain('names no flag')
  })

  it('ignores the template comments rather than counting them as content', () => {
    const withComments = bodyFrom(good).replace('## Frame\n', '## Frame\n\n<!-- a hint -->\n')
    const dir = mkdtempSync(join(tmpdir(), 'pr-'))
    temps.push(dir)
    const file = join(dir, 'body.md')
    writeFileSync(file, withComments)
    expect(
      spawnSync('node', [CHECK, '--body-file', file, '--root', ROOT], { encoding: 'utf8' }).status,
    ).toBe(0)
  })

  it('refuses the unfilled template, which is the most likely wrong answer', () => {
    const template = join(ROOT, '.github', 'pull_request_template.md')
    const result = spawnSync('node', [CHECK, '--body-file', template, '--root', ROOT], {
      encoding: 'utf8',
    })
    expect(result.status).toBe(1)
  })

  it('exits 2, not 1, when there is no body to read', () => {
    const result = spawnSync('node', [CHECK, '--root', ROOT], {
      encoding: 'utf8',
      env: { ...process.env, PR_BODY: undefined },
    })
    expect(result.status).toBe(2)
    expect(result.stderr).toContain('could not run')
  })

  /**
   * The check was correct and its input was not.
   *
   * CI passed the body from `github.event.pull_request.body`, a snapshot taken when the event
   * fired. A coding agent opens a draft whose body is a work-in-progress checklist and fills in
   * the real description later, so the check read a body nobody meant it to read and failed a
   * pull request that was right. This asserts the shape of that mistake, so nobody reintroduces
   * it by handing the check an early body again.
   */
  it('a work-in-progress checklist is refused, which is why the body must be read late', () => {
    const wip = [
      '- [x] Inspect the pack requirements',
      '- [x] Add the feature flag',
      '- [ ] Run `pnpm test:all`',
      '',
      '- Fixes #5',
    ].join('\n')
    const result = checkRaw(wip)
    expect(result.status).toBe(1)
    expect(`${result.stdout}${result.stderr}`).toMatch(/problem/)
  })
})
