#!/usr/bin/env node
/**
 * Check the source against the design pack.
 *
 * build-pack.mjs proves the token tiers are coherent. This proves the code obeys them. Between
 * them they are the difference between a design system that is written down and a design system
 * an agent can be held to.
 *
 * Every check here maps to an entry in `refuses` in design-system/pack.json, and the pack names
 * which check enforces it. A refusal with `enforced_by: "review"` is listed there as unenforced
 * on purpose, because a rule that claims a machine checks it when none does is worse than a rule
 * that admits it needs a person.
 *
 * Exit codes, and the reason they are distinct:
 *   0  everything passed
 *   1  a contract failure. The code is wrong. A person or an agent has to change it.
 *   2  the check could not run. Missing pack, unreadable file, bad JSON.
 *
 * Continuous integration treats 1 and 2 the same way, as a failure, so a check that did not run
 * is never reported as a check that passed. The codes stay distinct anyway because the two mean
 * completely different things to whoever reads the log.
 *
 * Run: node scripts/check-contract.mjs
 */
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { dirname, join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

/** `--root` points the check at another checkout, which is how it is tested. */
const flag = (name) => {
  const i = process.argv.indexOf(name)
  return i >= 0 ? process.argv[i + 1] : undefined
}

const ROOT = flag('--root') ?? join(dirname(fileURLToPath(import.meta.url)), '..')
const SRC = join(ROOT, 'src')
const COMPONENTS = join(SRC, 'components')
const PACK = join(ROOT, 'design-system', 'pack.json')

/** A check could not run. Distinct from a contract failure on purpose: see the header. */
class CannotRun extends Error {}

// A top level throw would exit 1, which is the code that means "the code is wrong". Anything
// this script cannot do is a different fact about the world and gets its own code.
process.on('uncaughtException', (error) => {
  if (error instanceof CannotRun) {
    console.error(`contract check could not run: ${error.message}`)
    process.exit(2)
  }
  console.error(`contract check could not run: ${error.stack ?? error}`)
  process.exit(2)
})

const findings = []
const rel = (path) => relative(ROOT, path)

/**
 * @param {string} refuseId  the entry in pack.refuses this enforces
 * @param {string} file
 * @param {string} detail    what is wrong, in the words a person would use
 * @param {string} fix       what to do instead
 */
const refuse = (refuseId, file, detail, fix) => findings.push({ refuseId, file, detail, fix })

function walk(dir, test) {
  const out = []
  let entries
  try {
    entries = readdirSync(dir)
  } catch (e) {
    throw new CannotRun(`cannot read ${rel(dir)}: ${e.message}`)
  }
  for (const entry of entries) {
    const path = join(dir, entry)
    if (statSync(path).isDirectory()) out.push(...walk(path, test))
    else if (test(entry)) out.push(path)
  }
  return out
}

// ─── the pack ───────────────────────────────────────────────────────────────

let pack
try {
  pack = JSON.parse(readFileSync(PACK, 'utf8'))
} catch (e) {
  throw new CannotRun(
    `cannot read the design pack at ${rel(PACK)}: ${e.message}\n` +
      'Run `pnpm build:pack` to generate it. Without the pack there is nothing to check against, ' +
      'and a check with nothing to check against must not pass.',
  )
}

const declared = new Set([
  ...Object.values(pack.tokens.semantic).map((t) => t.var),
  ...Object.values(pack.tokens.component).map((t) => t.var),
])
const packComponents = new Set(pack.components.map((c) => c.name))
const componentFiles = new Set(pack.components.map((c) => c.import))

// The accent tier is reached through a component token, never directly. `--ds-button-primary-bg`
// is the accent and says which accent it is; `--ds-accent-base` in a stylesheet is a component
// deciding for itself that it deserves the accent.
const ACCENT_VARS = /--ds-accent-(base|hover|subtle)\b/

// ─── stylesheets ────────────────────────────────────────────────────────────

const TOKEN_FIX =
  'every value is a var(--ds-*). A value the token layer does not carry is a gap in the token layer, not a local exception.'
const ACCENT_FIX =
  'the accent belongs to the action a screen exists for, and to focus. A component that wants it takes it through its own component token, which is reviewable, rather than helping itself.'

const stripComments = (css) => css.replace(/\/\*[\s\S]*?\*\//g, '')

const cssFiles = walk(SRC, (f) => f.endsWith('.css'))
if (cssFiles.length === 0) throw new CannotRun('no stylesheets found under src/')

for (const file of cssFiles) {
  const raw = readFileSync(file, 'utf8')
  const css = stripComments(raw)
  const name = rel(file)

  for (const [, varName] of css.matchAll(/var\((--ds-[a-z0-9-]+)/g)) {
    if (!declared.has(varName)) {
      refuse(
        'raw-value',
        name,
        `uses ${varName}, which the pack does not define`,
        'either the name is a typo, or the token layer is missing something. If it is missing, add it to design-system/tokens and run `pnpm build:pack`.',
      )
    }
  }

  for (const [match] of css.matchAll(/#[0-9a-fA-F]{3,8}\b|\b(?:rgba?|hsla?)\(/g)) {
    refuse(
      'raw-value',
      name,
      `carries the literal colour ${match.trim()}`,
      'every colour is a var(--ds-*). A colour the token layer does not carry is a gap in the token layer, not a local exception.',
    )
  }

  for (const [match] of css.matchAll(/(?<![\w-])\d*\.?\d+(px|rem|em)(?![\w-])/g)) {
    if (/^0(px|rem|em)$/.test(match)) continue
    refuse(
      'raw-value',
      name,
      `carries the literal length ${match}`,
      'spacing, sizing and radii come from the token layer so that one decision changes every surface at once.',
    )
  }

  for (const [match] of css.matchAll(/(?<![\w-])\d*\.?\d+m?s(?![\w-])/g)) {
    if (/^0m?s$/.test(match)) continue
    refuse(
      'raw-value',
      name,
      `carries the literal duration ${match}`,
      'durations come from the token layer, so reduced motion and a brand change both stay one decision.',
    )
  }

  if (ACCENT_VARS.test(css)) {
    refuse(
      'accent-spread',
      name,
      'reaches for the accent directly',
      'the accent belongs to the action a screen exists for, and to focus. A component that wants it takes it through its own component token, which is reviewable, rather than helping itself.',
    )
  }

  const animates = /\btransition(-duration|-property)?\s*:|\banimation(-name|-duration)?\s*:/.test(
    css,
  )
  if (animates && !css.includes('prefers-reduced-motion')) {
    refuse(
      'motion-unguarded',
      name,
      'animates without a prefers-reduced-motion guard',
      'add a @media (prefers-reduced-motion: reduce) block that collapses the duration. The state change still happens, it just stops moving.',
    )
  }
}

// ─── styled template literals ───────────────────────────────────────────────
//
// Styling that moved into a tagged template is styling the stylesheet scan cannot see. The same
// rules apply wherever the declaration lives, or "put it in a styled component" becomes the way
// around every rule in the pack.

const STYLED = /(?:styled|css)(?:\.[A-Za-z]+|\([^)]*\))?`([^`]*)`/gs

for (const file of walk(SRC, (f) => f.endsWith('.tsx') || f.endsWith('.ts'))) {
  const name = rel(file)
  if (/\.(stories|test|test-utils)\.tsx?$/.test(name)) continue
  const source = readFileSync(file, 'utf8')
  for (const [, block] of source.matchAll(STYLED)) {
    for (const [match] of block.matchAll(/#[0-9a-fA-F]{3,8}\b|\b(?:rgba?|hsla?)\(/g)) {
      refuse(
        'raw-value',
        name,
        `a styled block carries the literal colour ${match.trim()}`,
        TOKEN_FIX,
      )
    }
    for (const [match] of block.matchAll(/(?<![\w-])\d*\.?\d+(px|rem|em)(?![\w-])/g)) {
      if (/^0(px|rem|em)$/.test(match)) continue
      refuse('raw-value', name, `a styled block carries the literal length ${match}`, TOKEN_FIX)
    }
    if (ACCENT_VARS.test(block)) {
      refuse('accent-spread', name, 'a styled block reaches for the accent directly', ACCENT_FIX)
    }
  }
}

// ─── modules ────────────────────────────────────────────────────────────────

const tsFiles = walk(SRC, (f) => f.endsWith('.tsx') || f.endsWith('.ts'))
const ALLOWED_PACKAGES = new Set(['react', 'react-dom', 'react/jsx-runtime'])

// The component library underneath the pack. A pack component may wrap it, because that is what
// the pack IS: a narrower, checkable API over something broader. Nothing else may touch it. A
// feature reaching straight for a vendor component gets the vendor's whole surface, which is
// every prop the pack deliberately did not expose, and the pack stops describing what is shipped.
const VENDOR = pack.vendor?.package
const VENDOR_HOME = pack.vendor?.allowed_in ?? 'src/components'

for (const file of tsFiles) {
  const name = rel(file)
  // Stories, tests and their helpers are how the pack is exercised rather than part of it, so
  // they may reach for a testing library the pack itself may not.
  if (/\.(stories|test|test-utils)\.tsx?$|(^|\/)test-setup\.ts$/.test(name)) continue
  const source = readFileSync(file, 'utf8')
  const inPack = componentFiles.has(name)

  for (const [, spec] of source.matchAll(/(?:^|\n)\s*import\s[^'"]*['"]([^'"]+)['"]/g)) {
    const bare = !spec.startsWith('.') && !spec.startsWith('/')
    if (bare) {
      const pkg = spec.startsWith('@') ? spec.split('/').slice(0, 2).join('/') : spec.split('/')[0]
      if (VENDOR && pkg === VENDOR) {
        if (!name.startsWith(`${VENDOR_HOME}/`)) {
          refuse(
            'outside-pack',
            name,
            `imports ${VENDOR} outside ${VENDOR_HOME}`,
            `the pack may wrap the vendor and a feature may not reach past it. Add what this needs to a component in ${VENDOR_HOME}, where its props are named and its rules are checked.`,
          )
        }
        continue
      }
      if (!ALLOWED_PACKAGES.has(spec) && !ALLOWED_PACKAGES.has(pkg)) {
        refuse(
          'outside-pack',
          name,
          `imports ${spec}`,
          'the pack is the whole vocabulary. A second component library means two systems and one of them is undocumented.',
        )
      }
      continue
    }
    if (spec.endsWith('.css')) continue
    // The fence is the components directory, not the capital letter. A page or a hook may be
    // named like a component and is not one; what makes something a component here is living
    // where components live, and everything that lives there is in the pack.
    const target = resolve(dirname(file), spec)
    if (!target.startsWith(`${COMPONENTS}/`)) continue
    const componentName = target
      .split('/')
      .pop()
      ?.replace(/\.tsx?$/, '')
    if (componentName && !packComponents.has(componentName)) {
      refuse(
        'outside-pack',
        name,
        `imports ${componentName} from src/components, which the pack does not list`,
        'a design that needs something the pack does not have is a request to add it to the pack, reviewed once, rather than a local component in a feature folder.',
      )
    }
  }

  // A new stylesheet outside src/components is a component being built where nothing checks it.
  if (!inPack && source.includes(".css'")) {
    const declaresOwnCss = /import\s+'\.\/[A-Z][A-Za-z]*\.css'/.test(source)
    if (declaresOwnCss) {
      refuse(
        'outside-pack',
        name,
        'carries its own component stylesheet outside src/components',
        'components live in src/components and appear in the pack. A styled thing that does not is a component the system does not know about.',
      )
    }
  }
}

// ─── nothing lives in src/components that the pack does not list ────────────

for (const file of walk(COMPONENTS, (f) => f.endsWith('.tsx'))) {
  const base = rel(file)
    .split('/')
    .pop()
    .replace(/\.(stories|test)?\.?tsx$/, '')
  if (!packComponents.has(base)) {
    refuse(
      'outside-pack',
      rel(file),
      `${base} sits in src/components but the pack does not list it`,
      'the pack is the inventory. A component the pack does not name is a component no designer can find, no check knows the rules for, and no agent may use.',
    )
  }
}

// ─── every pack component is exercised ──────────────────────────────────────

const storyFiles = new Set(walk(SRC, (f) => f.endsWith('.stories.tsx')).map((f) => rel(f)))
const testFiles = new Set(walk(SRC, (f) => f.endsWith('.test.tsx')).map((f) => rel(f)))

for (const component of pack.components) {
  const base = component.import.replace(/\.tsx$/, '')
  if (!storyFiles.has(`${base}.stories.tsx`)) {
    refuse(
      'outside-pack',
      component.import,
      `${component.name} has no story`,
      'a component without a story cannot be reviewed by a designer, screenshotted, or checked for accessibility. It is in the pack, so it is exercised.',
    )
  }
  if (!testFiles.has(`${base}.test.tsx`)) {
    refuse(
      'outside-pack',
      component.import,
      `${component.name} has no test`,
      'the pack says this component exists and behaves a certain way. A test is how that stays true.',
    )
  }
}

// ─── report ─────────────────────────────────────────────────────────────────

if (findings.length === 0) {
  const enforced = pack.refuses.filter((r) => r.enforced_by !== 'review')
  console.log(
    `contract ok: ${cssFiles.length} stylesheets, ${pack.components.length} components, ` +
      `${enforced.length} of ${pack.refuses.length} refusals machine checked`,
  )
  process.exit(0)
}

const byRefuse = new Map()
for (const f of findings) {
  if (!byRefuse.has(f.refuseId)) byRefuse.set(f.refuseId, [])
  byRefuse.get(f.refuseId).push(f)
}

console.error(`contract failed: ${findings.length} finding(s)\n`)
for (const [refuseId, group] of byRefuse) {
  const says = pack.refuses.find((r) => r.id === refuseId)?.says ?? refuseId
  console.error(`${refuseId} — ${says}`)
  for (const f of group) console.error(`  ${f.file}: ${f.detail}`)
  console.error(`  → ${group[0].fix}\n`)
}
process.exit(1)
