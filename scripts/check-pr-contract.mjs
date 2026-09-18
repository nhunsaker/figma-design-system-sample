#!/usr/bin/env node
/**
 * Check that a pull request body fills the contract.
 *
 * An agent's report is a claim. This does not make the claim true, and nothing here tries to:
 * it makes the claim *present and specific*, so a reviewer is reading something answerable
 * rather than a paragraph of confident prose. The frame has to be a real link, the flag has to
 * be a flag that exists in the code, and Left undone has to say something.
 *
 * That last one is the point of the whole file. An agent that hit a wall and said so is worth
 * more than one that finished by widening the system quietly, and the only way to get the first
 * behaviour is to make the field mandatory and then actually read it.
 *
 * Usage:
 *   node scripts/check-pr-contract.mjs --body-file <path>
 *   node scripts/check-pr-contract.mjs            (reads PR_BODY from the environment)
 *
 * Exit codes match check-contract: 0 pass, 1 the body is wrong, 2 the check could not run.
 */
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const flag = (name) => {
  const i = process.argv.indexOf(name)
  return i >= 0 ? process.argv[i + 1] : undefined
}

const ROOT = flag('--root') ?? join(dirname(fileURLToPath(import.meta.url)), '..')

class CannotRun extends Error {}

process.on('uncaughtException', (error) => {
  console.error(
    `pull request check could not run: ${error instanceof CannotRun ? error.message : (error.stack ?? error)}`,
  )
  process.exit(2)
})

// ─── the body ───────────────────────────────────────────────────────────────

const bodyFile = flag('--body-file')
let body
if (bodyFile) {
  try {
    body = readFileSync(bodyFile, 'utf8')
  } catch (e) {
    throw new CannotRun(`cannot read ${bodyFile}: ${e.message}`)
  }
} else {
  body = process.env.PR_BODY
  if (body === undefined) {
    throw new CannotRun(
      'no --body-file and no PR_BODY in the environment, so there is nothing to check',
    )
  }
}

// ─── the flags that exist ───────────────────────────────────────────────────

let knownFlags
try {
  const source = readFileSync(join(ROOT, 'src', 'flags.ts'), 'utf8')
  const block = /export const flags = \{([\s\S]*?)\n\} as const/.exec(source)
  if (!block) throw new Error('could not find the flags object')
  knownFlags = [...block[1].matchAll(/^\s*'([^']+)'\s*:/gm)].map((m) => m[1])
  if (knownFlags.length === 0) throw new Error('the flags object is empty')
} catch (e) {
  throw new CannotRun(`cannot read the flags from src/flags.ts: ${e.message}`)
}

// ─── sections ───────────────────────────────────────────────────────────────

/** Split a markdown body into `heading -> content`, ignoring html comments. */
function sections(markdown) {
  const clean = markdown.replace(/<!--[\s\S]*?-->/g, '')
  const out = new Map()
  let current = null
  for (const line of clean.split('\n')) {
    const heading = /^##\s+(.+?)\s*$/.exec(line)
    if (heading) {
      current = heading[1].toLowerCase()
      out.set(current, [])
    } else if (current) {
      out.get(current).push(line)
    }
  }
  return new Map([...out].map(([k, v]) => [k, v.join('\n').trim()]))
}

const found = sections(body)
const problems = []
const fail = (detail, fix) => problems.push({ detail, fix })

const REQUIRED = ['frame', 'what changed', 'acceptance', 'flag', 'left undone']
for (const heading of REQUIRED) {
  if (!found.has(heading)) {
    fail(
      `the body has no "## ${heading}" section`,
      'copy .github/pull_request_template.md and fill every section. A missing section is not a shorter pull request, it is an unanswerable one.',
    )
    continue
  }
  if (found.get(heading) === '') {
    fail(
      `"## ${heading}" is empty`,
      'a heading with nothing under it reads as answered and is not. Say something, including "nothing" where that is the truth.',
    )
  }
}

// ─── the frame has to be a real place ───────────────────────────────────────

const frame = found.get('frame') ?? ''
if (frame && !/https:\/\/(?:www\.)?figma\.com\/(?:design|file|board)\/[A-Za-z0-9]+/.test(frame)) {
  fail(
    'the Frame section carries no Figma link',
    "paste the link to the frame, from Figma's own copy link. Without it nobody can check the change against what was asked for, which is the only question review is really answering.",
  )
} else if (frame && !/node[-_]id=/.test(frame)) {
  fail(
    'the Figma link names a file but not a frame',
    'use the link to the selected frame, which carries a node-id. A link to the file points at everything, which points at nothing.',
  )
}

// ─── the flag has to exist and has to be off ────────────────────────────────

const flagSection = found.get('flag') ?? ''
if (flagSection) {
  const named = [...flagSection.matchAll(/`([^`]+)`/g)].map((m) => m[1])
  if (named.length === 0) {
    fail(
      'the Flag section names no flag in backticks',
      `name the flag that gates this change, as it appears in src/flags.ts. Known flags: ${knownFlags.join(', ')}.`,
    )
  }
  for (const name of named) {
    if (!knownFlags.includes(name)) {
      fail(
        `the Flag section names ${name}, which is not in src/flags.ts`,
        `every change ships behind a flag that exists and is off. Known flags: ${knownFlags.join(', ')}.`,
      )
    }
  }
}

// ─── left undone has to say something ───────────────────────────────────────

const undone = found.get('left undone') ?? ''
if (undone && undone.replace(/[\s\-*.]/g, '').length < 4) {
  fail(
    'Left undone says almost nothing',
    'write what you could not do, what you were unsure about, or what you changed without being asked. "Nothing" is a valid answer when it is true, and it is the answer a reviewer will hold you to.',
  )
}

// ─── report ─────────────────────────────────────────────────────────────────

if (problems.length === 0) {
  console.log(`pull request contract ok: ${REQUIRED.length} sections, frame linked, flag known`)
  process.exit(0)
}

console.error(`pull request contract failed: ${problems.length} problem(s)\n`)
for (const p of problems) console.error(`  ${p.detail}\n  → ${p.fix}\n`)
process.exit(1)
