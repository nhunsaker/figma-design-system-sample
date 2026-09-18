/**
 * Tests for the two checks that hold the design system together.
 *
 * A check nobody has watched fail is a check nobody knows works. Every test here breaks the
 * repository on purpose, in a copy, and asserts that the build or the contract refuses it with
 * the right exit code and says something a person can act on. The happy path is one test; the
 * other eleven are the ones that matter.
 */
import { spawnSync } from 'node:child_process'
import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { afterEach, describe, expect, it } from 'vitest'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const BUILD = join(ROOT, 'design-system', 'build-pack.mjs')
const CONTRACT = join(ROOT, 'scripts', 'check-contract.mjs')

const temps = []
afterEach(() => {
  while (temps.length) rmSync(temps.pop(), { recursive: true, force: true })
})

/**
 * A throwaway copy of the design system, safe to break.
 *
 * figma/ comes too: the build reads the component key map from there, and a copy without it
 * builds a different pack than the one on disk, which reads as drift that is not there.
 */
function designSystemCopy() {
  const dir = mkdtempSync(join(tmpdir(), 'dss-'))
  temps.push(dir)
  cpSync(join(ROOT, 'design-system'), join(dir, 'design-system'), { recursive: true })
  cpSync(join(ROOT, 'figma'), join(dir, 'figma'), { recursive: true })
  return join(dir, 'design-system')
}

/** A throwaway copy of the whole checkout, safe to break. */
function checkoutCopy() {
  const dir = mkdtempSync(join(tmpdir(), 'dss-repo-'))
  temps.push(dir)
  cpSync(join(ROOT, 'design-system'), join(dir, 'design-system'), { recursive: true })
  cpSync(join(ROOT, 'src'), join(dir, 'src'), { recursive: true })
  return dir
}

const build = (dir, ...args) =>
  spawnSync('node', [BUILD, '--dir', dir, ...args], { encoding: 'utf8' })
const contract = (root) => spawnSync('node', [CONTRACT, '--root', root], { encoding: 'utf8' })

const editJson = (path, mutate) => {
  const data = JSON.parse(readFileSync(path, 'utf8'))
  mutate(data)
  writeFileSync(path, `${JSON.stringify(data, null, 2)}\n`)
}

// ─── the build ──────────────────────────────────────────────────────────────

describe('build-pack', () => {
  it('builds the committed token files and agrees with what is on disk', () => {
    const result = build(designSystemCopy(), '--check')
    expect(result.status).toBe(0)
    expect(result.stdout).toContain('up to date')
  })

  it('refuses a brand that sets a component-tier token', () => {
    const dir = designSystemCopy()
    editJson(join(dir, 'tokens', 'semantic.ember.json'), (d) => {
      d.button = { 'primary-bg': { $value: '{primitive.color.red.600}', $type: 'color' } }
    })
    const result = build(dir)
    expect(result.status).toBe(1)
    expect(result.stderr).toContain('which is a component-tier token')
    expect(result.stderr).toContain('a brand skins at the semantic tier')
  })

  it('refuses a brand that drops a key another brand declares', () => {
    const dir = designSystemCopy()
    editJson(join(dir, 'tokens', 'semantic.ember.json'), (d) => {
      delete d.accent.subtle
    })
    const result = build(dir)
    expect(result.status).toBe(1)
    expect(result.stderr).toContain('does not declare the same keys')
    expect(result.stderr).toContain('accent.subtle')
  })

  it('refuses a brand that invents a key no other brand has', () => {
    const dir = designSystemCopy()
    editJson(join(dir, 'tokens', 'semantic.ember.json'), (d) => {
      d.accent.glow = { $value: '{primitive.color.violet.200}' }
    })
    const result = build(dir)
    expect(result.status).toBe(1)
    expect(result.stderr).toContain('accent.glow')
  })

  it('refuses a component token that reaches past semantic to a primitive', () => {
    const dir = designSystemCopy()
    editJson(join(dir, 'tokens', 'component.json'), (d) => {
      d.button['primary-bg'].$value = '{primitive.color.blue.600}'
    })
    const result = build(dir)
    expect(result.status).toBe(1)
    expect(result.stderr).toContain('references the primitive tier')
  })

  it('refuses a component token written as a literal, which no brand could ever change', () => {
    const dir = designSystemCopy()
    editJson(join(dir, 'tokens', 'component.json'), (d) => {
      d.button['primary-bg'].$value = '#ff0000'
    })
    const result = build(dir)
    expect(result.status).toBe(1)
    expect(result.stderr).toContain('is the literal #ff0000')
  })

  it('refuses a reference that points at nothing', () => {
    const dir = designSystemCopy()
    editJson(join(dir, 'tokens', 'semantic.harbor.json'), (d) => {
      d.accent.base.$value = '{primitive.color.blue.999}'
    })
    const result = build(dir)
    expect(result.status).toBe(1)
    expect(result.stderr).toContain('does not exist')
  })

  it('refuses an accent that is also a status colour, because then it means neither', () => {
    const dir = designSystemCopy()
    editJson(join(dir, 'tokens', 'semantic.harbor.json'), (d) => {
      d.accent.base.$value = '{primitive.color.red.700}'
      d.accent.hover.$value = '{primitive.color.red.700}'
    })
    const result = build(dir)
    expect(result.status).toBe(1)
    expect(result.stderr).toContain('accent.base')
    expect(result.stderr).toContain('means neither')
  })

  it('refuses a vendor property wired to something that is not a semantic token', () => {
    const dir = designSystemCopy()
    editJson(join(dir, 'pack.meta.json'), (d) => {
      d.vendor.map.primary = 'color.blue.600'
    })
    const result = build(dir)
    expect(result.status).toBe(1)
    expect(result.stderr).toContain('--bs-primary')
    expect(result.stderr).toContain('not a semantic token')
  })

  it('refuses a brand whose text cannot be read on its own surface', () => {
    const dir = designSystemCopy()
    editJson(join(dir, 'tokens', 'semantic.harbor.json'), (d) => {
      d.text.secondary.$value = '{primitive.color.slate.300}'
    })
    const result = build(dir)
    expect(result.status).toBe(1)
    expect(result.stderr).toContain('text-secondary on surface-page')
    expect(result.stderr).toContain('below the 4.5')
  })

  it('refuses a control border too faint to find, at the lower structural ratio', () => {
    const dir = designSystemCopy()
    editJson(join(dir, 'tokens', 'semantic.ember.json'), (d) => {
      d.border.strong.$value = '{primitive.color.stone.200}'
    })
    const result = build(dir)
    expect(result.status).toBe(1)
    expect(result.stderr).toContain('border-strong on surface-raised')
    expect(result.stderr).toContain('below the 3')
  })

  it('checks contrast for every brand, not only the first one', () => {
    const dir = designSystemCopy()
    editJson(join(dir, 'tokens', 'semantic.harbor.json'), (d) => {
      d.accent.contrast.$value = '{primitive.color.blue.500}'
    })
    const result = build(dir)
    expect(result.status).toBe(1)
    expect(result.stderr).toContain('brand harbor')
  })

  it('reports stale artifacts rather than quietly rewriting them under --check', () => {
    const dir = designSystemCopy()
    writeFileSync(join(dir, 'tokens.harbor.css'), '/* hand edited */\n')
    const result = build(dir, '--check')
    expect(result.status).toBe(1)
    expect(result.stdout).toBe('')
    expect(result.stderr).toContain('out of date')
    expect(readFileSync(join(dir, 'tokens.harbor.css'), 'utf8')).toBe('/* hand edited */\n')
  })
})

// ─── the contract ───────────────────────────────────────────────────────────

describe('check-contract', () => {
  it('passes the committed source', () => {
    const result = contract(checkoutCopy())
    expect(result.status).toBe(0)
    expect(result.stdout).toContain('contract ok')
  })

  it('refuses a raw colour in a component stylesheet', () => {
    const root = checkoutCopy()
    const css = join(root, 'src', 'components', 'Button.css')
    writeFileSync(
      css,
      `${readFileSync(css, 'utf8')}\n.ds-button--primary { background: #ff0000; }\n`,
    )
    const result = contract(root)
    expect(result.status).toBe(1)
    expect(result.stderr).toContain('literal colour #ff0000')
  })

  it('refuses a raw length, so spacing stays one decision', () => {
    const root = checkoutCopy()
    const css = join(root, 'src', 'components', 'Card.css')
    writeFileSync(css, `${readFileSync(css, 'utf8')}\n.ds-card { padding-top: 13px; }\n`)
    const result = contract(root)
    expect(result.status).toBe(1)
    expect(result.stderr).toContain('literal length 13px')
  })

  it('refuses a token the pack does not define', () => {
    const root = checkoutCopy()
    const css = join(root, 'src', 'components', 'Badge.css')
    writeFileSync(css, `${readFileSync(css, 'utf8')}\n.ds-badge { color: var(--ds-badge-glow); }\n`)
    const result = contract(root)
    expect(result.status).toBe(1)
    expect(result.stderr).toContain('--ds-badge-glow')
  })

  it('refuses a component that helps itself to the accent', () => {
    const root = checkoutCopy()
    const css = join(root, 'src', 'components', 'Card.css')
    writeFileSync(
      css,
      `${readFileSync(css, 'utf8')}\n.ds-card__title { color: var(--ds-accent-base); }\n`,
    )
    const result = contract(root)
    expect(result.status).toBe(1)
    expect(result.stderr).toContain('accent-spread')
  })

  it('refuses motion with no reduced-motion guard', () => {
    const root = checkoutCopy()
    const css = join(root, 'src', 'components', 'Card.css')
    writeFileSync(
      css,
      `${readFileSync(css, 'utf8')}\n.ds-card { transition: opacity var(--ds-motion-duration-base); }\n`,
    )
    const result = contract(root)
    expect(result.status).toBe(1)
    expect(result.stderr).toContain('prefers-reduced-motion')
  })

  it('refuses a component library the pack does not know about', () => {
    const root = checkoutCopy()
    const file = join(root, 'src', 'components', 'Card.tsx')
    writeFileSync(file, `import { Tooltip } from 'some-ui-kit'\n${readFileSync(file, 'utf8')}`)
    const result = contract(root)
    expect(result.status).toBe(1)
    expect(result.stderr).toContain('some-ui-kit')
  })

  it('refuses a component dropped into src/components that the pack does not list', () => {
    const root = checkoutCopy()
    writeFileSync(
      join(root, 'src', 'components', 'Tooltip.tsx'),
      'export function Tooltip() {\n  return null\n}\n',
    )
    const result = contract(root)
    expect(result.status).toBe(1)
    expect(result.stderr).toContain('Tooltip sits in src/components')
  })

  it('allows a page to import a page, because the fence is the directory not the capital', () => {
    const root = checkoutCopy()
    writeFileSync(
      join(root, 'src', 'Settings.tsx'),
      'export function Settings() {\n  return null\n}\n',
    )
    writeFileSync(
      join(root, 'src', 'main.tsx'),
      `${readFileSync(join(root, 'src', 'main.tsx'), 'utf8')}\nimport { Settings } from './Settings'\nvoid Settings\n`,
    )
    expect(contract(root).status).toBe(0)
  })

  it('lets a pack component wrap the vendor library', () => {
    const root = checkoutCopy()
    const file = join(root, 'src', 'components', 'Card.tsx')
    writeFileSync(
      file,
      `import { Stack } from '@metatoy/bootstrap-styled'\nvoid Stack\n${readFileSync(file, 'utf8')}`,
    )
    expect(contract(root).status).toBe(0)
  })

  it('refuses a feature reaching past the pack to the vendor library', () => {
    const root = checkoutCopy()
    const file = join(root, 'src', 'App.tsx')
    writeFileSync(
      file,
      `import { Stack } from '@metatoy/bootstrap-styled'\nvoid Stack\n${readFileSync(file, 'utf8')}`,
    )
    const result = contract(root)
    expect(result.status).toBe(1)
    expect(result.stderr).toContain('outside src/components')
  })

  it('refuses a raw colour hidden in a styled template literal', () => {
    const root = checkoutCopy()
    const file = join(root, 'src', 'components', 'Card.tsx')
    writeFileSync(
      file,
      `const x = styled.div\`color: #ff0000;\`\nvoid x\n${readFileSync(file, 'utf8')}`,
    )
    const result = contract(root)
    expect(result.status).toBe(1)
    expect(result.stderr).toContain('styled block carries the literal colour')
  })

  it('refuses a raw length hidden in a styled template literal', () => {
    const root = checkoutCopy()
    const file = join(root, 'src', 'components', 'Card.tsx')
    writeFileSync(file, `const x = css\`padding: 13px;\`\nvoid x\n${readFileSync(file, 'utf8')}`)
    const result = contract(root)
    expect(result.status).toBe(1)
    expect(result.stderr).toContain('styled block carries the literal length 13px')
  })

  it('refuses a component in the pack that has no story', () => {
    const root = checkoutCopy()
    rmSync(join(root, 'src', 'components', 'Toast.stories.tsx'))
    const result = contract(root)
    expect(result.status).toBe(1)
    expect(result.stderr).toContain('Toast has no story')
  })

  it('exits 2, not 1, when there is no pack to check against', () => {
    const root = checkoutCopy()
    rmSync(join(root, 'design-system', 'pack.json'))
    const result = contract(root)
    expect(result.status).toBe(2)
    expect(result.stderr).toContain('could not run')
  })

  it('exits 2 when the pack is there but unreadable', () => {
    const root = checkoutCopy()
    writeFileSync(join(root, 'design-system', 'pack.json'), '{ not json')
    const result = contract(root)
    expect(result.status).toBe(2)
  })
})
