#!/usr/bin/env node
/**
 * Build the design pack from the token tiers.
 *
 * Three files in `tokens/` are the source of truth and nothing else may be hand maintained:
 *
 *   tokens.<brand>.css    the semantic tier for one brand, as CSS custom properties
 *   tokens.components.css the component tier, compiled once for every brand
 *   pack.json             the bounded context an agent reads before it builds anything
 *
 * The editorial half of pack.json lives in pack.meta.json, because no parser can derive what a
 * colour means or what a component is for. Everything else is derived here so it cannot drift.
 * Drift is the failure this kind of system is most prone to: the specimen keeps looking correct
 * while the shipped stylesheet rots underneath it.
 *
 * The tier rule is enforced by the compiler rather than by review:
 *
 *   primitive   raw values. Never emitted as a custom property, so nothing downstream can
 *               reach past the semantic tier even if it wants to.
 *   semantic    the only tier a brand may edit. Every brand declares the identical key set.
 *   component   resolves from semantic only, so it compiles once for all brands.
 *
 * The script fails loudly rather than guessing. Every check below stops the build:
 *   a reference that does not resolve, or a cycle;
 *   a primitive that references anything;
 *   a semantic token that references another semantic token or a component token;
 *   a component token that references a primitive, skipping the semantic tier;
 *   a brand that defines a component-tier path;
 *   a brand missing a key another brand has, or carrying one no other brand has;
 *   a semantic and a component token that would compile to the same custom property;
 *   an accent that is the same colour as a status, because then the accent means two things.
 *
 * Run: node design-system/build-pack.mjs [--check]
 * `--check` writes nothing and exits 1 if any artifact on disk is out of date.
 */
import { createHash } from 'node:crypto'
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

/** `--dir` points the build at another design-system directory, which is how it is tested. */
const flag = (name) => {
  const i = process.argv.indexOf(name)
  return i >= 0 ? process.argv[i + 1] : undefined
}

const HERE = flag('--dir') ?? dirname(fileURLToPath(import.meta.url))
const TOKENS = join(HERE, 'tokens')
const CHECK = process.argv.includes('--check')
const VAR_PREFIX = '--ds-'

/** Thrown for every rule in the header. Carries no stack: the message is the whole point. */
class BuildError extends Error {
  constructor(message, hint) {
    super(hint ? `${message}\n   ${hint}` : message)
    this.name = 'BuildError'
  }
}

// ─── reading ────────────────────────────────────────────────────────────────

const readJson = (path) => {
  try {
    return JSON.parse(readFileSync(path, 'utf8'))
  } catch (e) {
    throw new BuildError(`cannot read ${path}`, e.message)
  }
}

/**
 * Flatten a DTCG tree to `path -> {value, type}`. `$type` is inherited from the nearest
 * ancestor that declares it, which is what keeps the source files readable.
 * @returns {Map<string, {value: string, type: string|null}>}
 */
function flatten(tree, inheritedType = null, prefix = '') {
  const out = new Map()
  const type = tree.$type ?? inheritedType
  for (const [key, node] of Object.entries(tree)) {
    if (key.startsWith('$') || key.startsWith('_')) continue
    if (node === null || typeof node !== 'object') continue
    const path = prefix ? `${prefix}.${key}` : key
    if ('$value' in node) {
      out.set(path, { value: String(node.$value), type: node.$type ?? type })
    } else {
      for (const [k, v] of flatten(node, type, path)) out.set(k, v)
    }
  }
  return out
}

const REF = /^\{([a-z0-9-]+(?:\.[a-zA-Z0-9-]+)*)\}$/

/** The tier a reference points into, or null when the value is a literal. */
const refTarget = (value) => {
  const m = REF.exec(value.trim())
  if (!m) return null
  const path = m[1]
  const dot = path.indexOf('.')
  if (dot < 0) throw new BuildError(`reference ${value} names no tier`)
  return { tier: path.slice(0, dot), path: path.slice(dot + 1), full: path }
}

// ─── load ───────────────────────────────────────────────────────────────────

/**
 * Figma component key to pack component name, written by scripts/sync-figma-keys.mjs from the
 * published library, one entry per published variant. Absent or empty is a normal state, not an error: it means Code Connect has
 * not mapped anything yet, and everything downstream says so rather than guessing.
 */
const codeConnect = (() => {
  const path = join(HERE, '..', 'figma', 'code-connect.json')
  if (!existsSync(path)) return { file_key: null, components: {} }
  return readJson(path)
})()

const primitiveSrc = readJson(join(TOKENS, 'primitive.json'))
const componentSrc = readJson(join(TOKENS, 'component.json'))
const meta = readJson(join(HERE, 'pack.meta.json'))

const brandFiles = readdirSync(TOKENS)
  .filter((f) => f.startsWith('semantic.') && f.endsWith('.json'))
  .sort()
if (brandFiles.length < 2) {
  throw new BuildError(
    `found ${brandFiles.length} brand file(s) in design-system/tokens`,
    'a one brand system cannot demonstrate the tier rule. Keep at least two.',
  )
}

const brands = brandFiles.map((file) => {
  const src = readJson(join(TOKENS, file))
  const name = file.slice('semantic.'.length, -'.json'.length)
  return { name, file, src, tokens: flatten(src) }
})

const primitive = flatten(primitiveSrc)
const component = flatten(componentSrc)

// ─── validate the tiers ─────────────────────────────────────────────────────

for (const [path, { value }] of primitive) {
  if (refTarget(value)) {
    throw new BuildError(
      `primitive.${path} references ${value}`,
      'primitives are raw values. A primitive that points at something else is a semantic token in the wrong file.',
    )
  }
}

const componentPaths = new Set(component.keys())
const reference = brands[0]

for (const brand of brands) {
  for (const path of brand.tokens.keys()) {
    if (componentPaths.has(path)) {
      throw new BuildError(
        `brand ${brand.name} defines ${path}, which is a component-tier token`,
        'a brand skins at the semantic tier or it does not skin. If the component tier cannot express what this brand needs, the semantic tier has a gap: add the key there, for every brand, once.',
      )
    }
  }
  if (brand === reference) continue
  const missing = [...reference.tokens.keys()].filter((k) => !brand.tokens.has(k))
  const extra = [...brand.tokens.keys()].filter((k) => !reference.tokens.has(k))
  if (missing.length || extra.length) {
    const lines = []
    if (missing.length) lines.push(`missing: ${missing.join(', ')}`)
    if (extra.length) lines.push(`only in ${brand.name}: ${extra.join(', ')}`)
    throw new BuildError(
      `brand ${brand.name} does not declare the same keys as ${reference.name}`,
      `${lines.join(' | ')}\n   Every brand declares the identical key set. A key one brand needs is a key every brand declares.`,
    )
  }
}

for (const [path, { value }] of brands[0].tokens) {
  const ref = refTarget(value)
  if (!ref) continue
  if (ref.tier !== 'primitive') {
    throw new BuildError(
      `semantic.${path} references the ${ref.tier} tier`,
      'the semantic tier reads primitives and nothing else. A semantic token pointing at another semantic token hides which decision is the real one.',
    )
  }
}

for (const [path, { value }] of component) {
  const ref = refTarget(value)
  if (!ref) {
    throw new BuildError(
      `component.${path} is the literal ${value}`,
      'every component token resolves from the semantic tier. A literal here is a value one brand can never change.',
    )
  }
  if (ref.tier !== 'semantic') {
    throw new BuildError(
      `component.${path} references the ${ref.tier} tier`,
      'the component tier reads semantic tokens only. Reaching past semantic to a primitive is how a component stops responding to a brand.',
    )
  }
}

// ─── resolve ────────────────────────────────────────────────────────────────

const cssVar = (path) => VAR_PREFIX + path.replace(/\./g, '-')

/** Resolve a semantic token to a literal primitive value. */
function resolveSemantic(brand, path, seen = new Set()) {
  if (seen.has(path)) throw new BuildError(`reference cycle at semantic.${path}`)
  seen.add(path)
  const token = brand.tokens.get(path)
  if (!token) throw new BuildError(`brand ${brand.name} has no token ${path}`)
  const ref = refTarget(token.value)
  if (!ref) return token.value
  const target = primitive.get(ref.path)
  if (!target) {
    throw new BuildError(
      `semantic.${path} in brand ${brand.name} references {${ref.full}}, which does not exist`,
      'check design-system/tokens/primitive.json for the real path.',
    )
  }
  return target.value
}

for (const brand of brands) {
  brand.resolved = new Map()
  for (const path of brand.tokens.keys()) brand.resolved.set(path, resolveSemantic(brand, path))
}

/** Component tokens compile to a var() reference, never to a literal, so a brand flows through. */
const componentResolved = new Map()
for (const [path, token] of component) {
  const ref = refTarget(token.value)
  if (!reference.tokens.has(ref.path)) {
    throw new BuildError(
      `component.${path} references {${ref.full}}, which no brand declares`,
      'add the key to every semantic brand file, or point this token at one that exists.',
    )
  }
  componentResolved.set(path, `var(${cssVar(ref.path)})`)
}

// a semantic and a component token that compile to the same property would silently overwrite
for (const path of componentResolved.keys()) {
  if (reference.tokens.has(path)) {
    throw new BuildError(
      `${path} exists in both the semantic and component tiers`,
      `both compile to ${cssVar(path)} and one would win at random. Rename one.`,
    )
  }
}

// the accent means one thing. If it is also a status colour it means two, so it means nothing.
for (const brand of brands) {
  const accent = brand.resolved.get('accent.base')
  for (const [path, value] of brand.resolved) {
    if (!path.startsWith('status.') || !path.endsWith('-fg')) continue
    if (value.toLowerCase() === String(accent).toLowerCase()) {
      throw new BuildError(
        `brand ${brand.name} uses ${accent} for both accent.base and ${path}`,
        'the accent means the action this screen exists for. A colour that also means "danger" means neither.',
      )
    }
  }
}

// ─── contrast: an illegal brand does not compile ────────────────────────────
//
// Accessibility that is audited after the fact is accessibility that ships broken and gets
// fixed at the least convenient moment. Every pairing the system actually puts on screen is
// declared in pack.meta.json and computed here, per brand, from the resolved values. A brand
// whose palette cannot carry its own text is a build failure, which is the only feedback fast
// enough to change what somebody picks.

/** sRGB relative luminance, WCAG 2.2 definition. */
function luminance(hex) {
  const m = /^#([0-9a-f]{6})$/i.exec(hex.trim())
  if (!m)
    throw new BuildError(
      `cannot measure the contrast of ${hex}`,
      'colours are six digit hex so they can be checked.',
    )
  const channels = [0, 2, 4].map((i) => Number.parseInt(m[1].slice(i, i + 2), 16) / 255)
  const linear = channels.map((c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4))
  return 0.2126 * linear[0] + 0.7152 * linear[1] + 0.0722 * linear[2]
}

const ratio = (a, b) => {
  const [l1, l2] = [luminance(a), luminance(b)].sort((x, y) => y - x)
  return (l1 + 0.05) / (l2 + 0.05)
}

/** A declared pair name such as `text-primary` back to the token path `text.primary`. */
const pathOf = (varName) => {
  for (const key of reference.tokens.keys()) {
    if (cssVar(key) === VAR_PREFIX + varName) return key
  }
  throw new BuildError(
    `pack.meta.json declares a contrast pair for ${varName}, which is not a semantic token`,
    'the pairs name semantic tokens by their custom property, without the --ds- prefix.',
  )
}

for (const [kind, minimum] of [
  ['text', 4.5],
  ['structural', 3],
]) {
  for (const [fgName, bgName] of meta.contrast?.[kind] ?? []) {
    const [fg, bg] = [pathOf(fgName), pathOf(bgName)]
    for (const brand of brands) {
      const measured = ratio(brand.resolved.get(fg), brand.resolved.get(bg))
      if (measured + 1e-9 < minimum) {
        throw new BuildError(
          `brand ${brand.name}: ${fgName} on ${bgName} is ${measured.toFixed(2)} to 1, below the ${minimum} this pairing needs`,
          `${brand.resolved.get(fg)} on ${brand.resolved.get(bg)}. Pick a different step on the primitive scale, or stop pairing these two.`,
        )
      }
    }
  }
}

// ─── emit ───────────────────────────────────────────────────────────────────

// ─── the vendor bridge ──────────────────────────────────────────────────────
//
// The component library underneath the pack exposes its own runtime custom properties. Rather
// than theming it through a config object, the semantic tier is pointed straight at that surface,
// so a brand change re-skins every vendor component at runtime with no rebuild and no second
// source of truth.
//
// The map lives in pack.meta.json and is compiled here. A right hand side that is not a semantic
// token stops the build, which is what stops the bridge quietly rotting as the token layer moves.

const vendorPairs = Object.entries(meta.vendor?.map ?? {})
for (const [property, token] of vendorPairs) {
  if (!reference.tokens.has(token)) {
    throw new BuildError(
      `the vendor map points --bs-${property} at ${token}, which is not a semantic token`,
      'the bridge may only read the semantic tier. A vendor property wired to a primitive would stop responding to a brand, and one wired to nothing is a silent default.',
    )
  }
}

function vendorCss() {
  const lines = vendorPairs.map(([property, token]) => `  --bs-${property}: var(${cssVar(token)});`)
  return `${BANNER(
    `Vendor bridge for ${meta.vendor?.package ?? 'the component library'}.\n * Its runtime properties read this system's semantic tier, so a brand change re-skins every\n * vendor component without a rebuild. The pack names the one place the vendor may be imported.`,
  )}\n:root {\n${lines.join('\n')}\n}\n`
}

const BANNER = (what) =>
  `/* ${what}\n * Generated by design-system/build-pack.mjs. Do not edit.\n * Change design-system/tokens/, run \`pnpm build:pack\`, and commit both.\n */\n`

function brandCss(brand) {
  const lines = [...brand.resolved].map(([path, value]) => `  ${cssVar(path)}: ${value};`)
  return `${BANNER(`Semantic tier, brand ${brand.name}.`)}\n.brand-${brand.name} {\n${lines.join('\n')}\n}\n`
}

function componentCss() {
  const lines = [...componentResolved].map(([path, value]) => `  ${cssVar(path)}: ${value};`)
  return `${BANNER(
    'Component tier. One stylesheet for every brand, because every value here resolves from\n * the semantic tier. This file is the proof that a brand cannot fork a component.',
  )}\n:root {\n${lines.join('\n')}\n}\n`
}

const sourceHash = createHash('sha256')
for (const file of ['primitive.json', 'component.json', ...brandFiles]) {
  sourceHash.update(readFileSync(join(TOKENS, file)))
}
sourceHash.update(readFileSync(join(HERE, 'pack.meta.json')))

const packTokens = { semantic: {}, component: {} }
for (const path of reference.tokens.keys()) {
  const role = meta.roles?.[path.replace(/\./g, '-')]
  packTokens.semantic[path] = {
    var: cssVar(path),
    type: reference.tokens.get(path).type,
    ...(role ? { means: role } : {}),
    values: Object.fromEntries(brands.map((b) => [b.name, b.resolved.get(path)])),
  }
}
for (const [path, token] of component) {
  packTokens.component[path] = {
    var: cssVar(path),
    type: token.type,
    resolves_to: cssVar(refTarget(token.value).path),
  }
}

const pack = {
  v: 1,
  id: meta.id,
  name: meta.name,
  premise: meta.premise,
  north_stars: meta.north_stars,
  source: {
    generated_by: 'design-system/build-pack.mjs',
    editorial: 'design-system/pack.meta.json',
    tokens: [
      'design-system/tokens/primitive.json',
      ...brandFiles.map((f) => `design-system/tokens/${f}`),
      'design-system/tokens/component.json',
    ],
    hash: sourceHash.digest('hex').slice(0, 16),
    note: 'Generated from the committed token files. A build never needs a live design connection, so every commit builds the same way.',
  },
  brands: brands.map((b) => ({
    name: b.name,
    class: `brand-${b.name}`,
    stylesheet: `design-system/tokens.${b.name}.css`,
    description: b.src.$description ?? null,
    accent: b.resolved.get('accent.base'),
  })),
  tiers: {
    primitive:
      'Raw values. Never emitted as a custom property, so nothing can reach past the semantic tier. The core team owns it.',
    semantic: 'The only tier a brand may edit. Every brand declares the identical key set.',
    component: 'Resolves from semantic only, so it compiles once for every brand.',
  },
  figma: {
    file_key: codeConnect.file_key ?? null,
    mapped: new Set(Object.values(codeConnect.components ?? {})).size,
    keys: Object.keys(codeConnect.components ?? {}).length,
    of: meta.components.length,
  },
  components: meta.components.map((c) => ({
    ...c,
    figma_keys: Object.entries(codeConnect.components ?? {})
      .filter(([, name]) => name === c.name)
      .map(([key]) => key),
    tokens: [...componentResolved.keys()]
      .filter((p) => p.startsWith(`${c.name.toLowerCase()}.`))
      .map((p) => cssVar(p)),
  })),
  tokens: packTokens,
  contrast: meta.contrast,
  vendor: meta.vendor
    ? {
        package: meta.vendor.package,
        allowed_in: meta.vendor.allowed_in,
        stylesheet: 'design-system/tokens.vendor.css',
        properties: vendorPairs.length,
      }
    : null,
  rules: meta.rules,
  refuses: meta.refuses,
  visual: meta.visual,
}

const artifacts = [
  ...brands.map((b) => [join(HERE, `tokens.${b.name}.css`), brandCss(b)]),
  [join(HERE, 'tokens.components.css'), componentCss()],
  [join(HERE, 'tokens.vendor.css'), vendorCss()],
  [join(HERE, 'pack.json'), `${JSON.stringify(pack, null, 2)}\n`],
]

if (CHECK) {
  const stale = artifacts.filter(
    ([path, body]) => !existsSync(path) || readFileSync(path, 'utf8') !== body,
  )
  if (stale.length) {
    console.error('design pack is out of date:')
    for (const [path] of stale) console.error(`  ${path.replace(`${HERE}/`, 'design-system/')}`)
    console.error('\nRun `pnpm build:pack` and commit the result.')
    process.exit(1)
  }
  console.log(`design pack up to date: ${artifacts.length} artifacts, source ${pack.source.hash}`)
} else {
  for (const [path, body] of artifacts) writeFileSync(path, body)
  const semantic = reference.tokens.size
  console.log(
    `built ${brands.length} brands (${brands.map((b) => b.name).join(', ')}), ` +
      `${semantic} semantic tokens, ${componentResolved.size} component tokens, source ${pack.source.hash}`,
  )
}
