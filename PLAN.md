# figma-design-system-sample — a frame marked ready becomes a conforming PR

Repo: `~/workspace/nhunsaker/figma-design-system-sample/` (created 2026-09-17, `git init -b main`,
README + .gitignore, nothing committed). This plan is copied into the repo as `PLAN.md` on approval.

## Context

The A5 Labs Stage 3 session (Sebastian Waschnick, 60–75 min, live system design) asks for a system where
a design in Figma flows through AI and comes out as production frontend code that conforms to the design
system: architecture, guardrails, validation, operating model. The conclusion reached on 2026-09-17: the
integration is small because Figma and GitHub already built the pipes; the real work is making the design
system a contract an agent can be held to. This repo is the proof of that sentence, small enough to build in
about a week and show in the room: **a frame marked ready for development becomes a pull request that
satisfies the design-system contract, with checks attached, a person approving, and the PR pinned back on
the frame.**

Foundation is the FLS work, copied not imported (the founder's call: code may live in two places for
simplicity). Nothing here depends on the FLS engine, the harness VM, or Pocket content. It is a public,
standalone sample under `github.com/nhunsaker`, like `github-triage-agent-tutorial`.

What FLS contributes, and where it is copied from:

| FLS piece | Source | Used here as |
|---|---|---|
| Pack build + `--check` (tokens → DTCG → CSS vars → `pack.json`; fails loudly on drift) | `metatoy/fls-harness-demo/design-system/build-pack.mjs`, `pack.meta.json` shape (`rules`, `refuses`, `roles`) | `design-system/build-pack.mjs`, `pack.meta.json` |
| Webhook signature check + minimal GitHub REST client | `fidelity-ladder-system/engine/src/fls/github_surface.py` (`verify_signature`, `RestGitHubClient`, `parse_issue_form`) | `bridge/github.py` |
| Fail-closed verifier idea: a check that did not run is not a pass; design failures vs mechanical failures | `engine/src/fls/local_verifier.py`, `verifier.py` | `.github/workflows/verify.yml` job shape + `scripts/check-contract.mjs` exit codes |
| Declared output contract from an agent session (JSON block or fail) and the structure lint on frames | `engine/src/fls/builders/figma_wireframe.py` | the PR-body contract the agent must fill (`docs/pr-contract.md`) |
| The core system diagram | `…/stage3-working-session/system-diagram/system-diagram.mmd` | `docs/system-diagram.mmd` |
| Figma connectivity facts (webhooks v2, REST limits, MCP, Code Connect, Dev Mode) | `…/stage3-working-session/figma-connectivity.html` | `docs/figma-connectivity.md` (condensed) |

Vocabulary on the public surface: spec, design, build, review, ship. No rung, dial, anchor, expedition,
vessel. Prose follows the voice profile (no dashes or semicolons as punctuation in README/docs).

## The system in one line each

1. **Trigger.** A designer sets a frame's Dev Mode status to *Ready for development*. Figma fires a
   `DEV_MODE_STATUS_UPDATE` webhook (v2, scoped to the sample file).
2. **Bridge.** A ~150-line FastAPI service verifies the passcode, reads the frame over REST
   (`GET /v1/files/:key/nodes?ids=`, `GET /v1/images/:key` for a PNG), and opens a GitHub issue carrying the
   design context: node tree summary, the components the frame instances (matched to `pack.json` by
   Code Connect key), the PNG, and the acceptance stub. It labels the issue `design:ready`.
3. **Agent.** The issue is assigned to the Copilot coding agent (v1). It reads `pack.json` and
   `AGENTS.md`, builds the change in `src/`, adds a Storybook story, and opens a draft PR whose body fills
   the PR contract.
4. **Verify (CI).** Typecheck, lint, unit tests, `build-pack --check` (pack in sync with source),
   `check-contract` (only pack components used, no raw hex or px the token layer already carries, both
   brands still compile), axe on the new story, and a visual diff of the story screenshot against the
   Figma PNG (advisory in v1, blocking later). A failed or skipped check is a failed check.
5. **Review.** One human approves. Branch protection + CODEOWNERS on `design-system/` and `src/` so the
   agent can never merge its own PR.
6. **Write-back.** On PR open: `POST /v1/dev_resources` pins the PR URL to the frame. On merge: a Figma
   comment on the frame with the Storybook link. On close-without-merge: a comment with the reason. Marking
   the frame *Completed* stays a person's click (REST cannot set the status).
7. **Ship.** Merge lands behind a feature flag that is off. Storybook deploys to GitHub Pages as the stage.

Trust boundaries, drawn in the diagram and honoured in code: Figma cloud (webhook out, REST in with a
scoped token) · the bridge (holds the Figma token and a fine-grained GitHub token, nothing else) · GitHub
(the agent runs here with no Figma credential at all, it only sees what the issue carries).

## Repo layout

```
figma-design-system-sample/
  README.md · PLAN.md · LICENSE (MIT) · AGENTS.md (what an agent may and may not do here)
  design-system/
    tokens/            primitive.json · semantic.brand-a.json · semantic.brand-b.json · component.json (DTCG)
    build-pack.mjs     tokens → tokens.css per brand · pack.json (components, tokens, rules, refuses)
    pack.meta.json     the editorial half: what each colour means, what each component is for, rules, refuses
    pack.json          generated, committed, checked in CI
  scripts/check-contract.mjs   the conformance lint (see Verify)
  src/components/      Button · Badge · Card · Input · Tabs · Toast — each: .tsx · .stories.tsx · .test.tsx
  src/flags.ts         one feature flag, off
  .storybook/          Storybook 8 + a11y addon + test-runner
  figma/               figma.config.json · *.figma.tsx Code Connect mappings · FILE.md (the sample file key)
  bridge/              app.py (FastAPI) · figma.py · github.py · tests/ · README.md (how to run it, tunnel)
  .github/
    workflows/verify.yml · figma-writeback.yml · pages.yml
    CODEOWNERS
  docs/
    system-diagram.mmd · figma-connectivity.md · pr-contract.md · operating-model.md · DECISIONS.md
```

Stack (assumption, easy to change at approval): React 19 + TypeScript + Vite, pnpm, Node 22, Storybook 8,
Vitest, Biome, axe via `@storybook/test-runner`. Bridge in Python 3.12 + FastAPI + httpx so the FLS
`github_surface.py` code copies over as is. TypeScript is fine here: this is the nhunsaker workspace, not
the Sorb tree.

## The design-system contract (the part that is actually the work)

- **Three token tiers**, DTCG: primitive (core team only) → semantic (where a brand skins) → component
  (resolves from semantic, nobody overrides). Two brands, not seventeen, to show the tier rule with the
  smallest thing that demonstrates it. `build-pack.mjs` compiles `tokens.brand-a.css` and
  `tokens.brand-b.css` and stops the build on: a component-tier value set directly by a brand file, a
  semantic token a brand omits, a `var(--ds-*)` used in `src/` that no token defines.
- **`pack.json`** carries `components` (name, Code Connect key, props, allowed slots), `tokens`, `rules`,
  `refuses`. The rules are the six from Night Shift rewritten for a neutral system (one accented action per
  screen, colour never alone, every stylesheet value a token var, 44px targets, tabular figures, reduced
  motion honoured). `refuses` is short and mechanically checkable in this sample (no raw hex, no
  component outside the pack, no accent colour on non-primary actions), and `docs/DECISIONS.md` records
  that judgement-class refuses are out of scope here and why.
- **Code Connect** maps each Figma component to its `src/components/*.tsx` so `get_design_context` and the
  bridge's REST read both resolve a frame to real component names. `figma/FILE.md` records the file key
  and the publish steps.

## Verify, precisely

`scripts/check-contract.mjs` exits: 0 pass, 1 contract failure (a design problem, blocks), 2 could not run
(missing pack, parse error, also blocks). CI treats 1 and 2 the same way, as a failure, so a skipped check
never reads as green. Checks:

| Check | Tool | v1 status |
|---|---|---|
| Types, lint, unit | tsc, biome, vitest | blocking |
| Pack in sync | `build-pack.mjs --check` | blocking |
| Only pack components imported in `src/` | `check-contract.mjs` | blocking |
| No raw hex/px that the token layer carries | `check-contract.mjs` | blocking |
| Both brands compile and no brand touches component tier | `build-pack.mjs` | blocking |
| Accessibility on changed stories | storybook test-runner + axe | blocking |
| Story screenshot vs Figma PNG | pixelmatch, threshold in `pack.meta.json` | advisory (comment on PR) |
| PR body fills the contract (what changed, which frame, acceptance stub, flag name) | `scripts/check-pr-contract.mjs` | blocking |

## Phases

**P0 · Scaffold (½ day).** pnpm + Vite + React + TS + Storybook + Vitest + Biome; LICENSE; `AGENTS.md`;
`verify.yml` green on an empty tree. Copy `system-diagram.mmd` and condense `figma-connectivity.html` into
`docs/figma-connectivity.md`.

**P1 · Contract (1½ days).** Token files, `build-pack.mjs` (adapted from the FLS one: three tiers, two
brands, `--check`), `pack.meta.json`, `pack.json`, `check-contract.mjs` with tests, six components with
stories and tests, `flags.ts`. CI blocking on everything but visual.

**P2 · Figma side (½ day, founder in the loop).** Founder creates the sample Figma file (six components
as a small library, one page "Requests" with two frames built from them). Code Connect mappings published
via `figma connect publish`. Figma PAT (scopes: `file_content:read`, `file_dev_resources:write`,
`file_comments:write`, `webhooks:write`) stored in the macOS Keychain, indexed in `KEYCHAIN.md`, never
in the repo.

**P3 · Bridge (1 day).** `bridge/app.py`: `POST /figma/webhook` (passcode check copied from
`verify_signature`, adapted to Figma's `passcode` field), `figma.py` (nodes + image export + component
resolution against `pack.json`), `github.py` (copied `RestGitHubClient`, plus create issue, add label,
assign Copilot via GraphQL `replaceActorsForAssignable`). Tests with recorded fixtures for both APIs.
Local run through a `cloudflared` tunnel; webhook registered against the sample file only.

**P4 · Agent + write-back (1 day).** `AGENTS.md` tells the agent to read `pack.json`, use only pack
components, add a story, fill the PR contract, never touch `design-system/`. `figma-writeback.yml`:
on PR opened → dev resource; on closed → Figma comment (merged or not). Branch protection + CODEOWNERS.
Copilot coding agent is v1 because it needs no model credential in the repo. Claude Code in Actions is
documented in `docs/DECISIONS.md` as the alternative and what it would need (a secret, which is a gate).

**P5 · One recorded run + docs (1 day).** Mark frame → issue → PR → checks → approve → merge → dev
resource visible in Figma. Screenshots into `docs/images/`. README walkthrough in the voice profile.
`docs/operating-model.md`: who may change each tier, how autonomy widens as checks prove out (advisory →
blocking, draft PR → ready PR), what a rejection looks like, the numbers to watch (PRs per frame, checks
failed per class, time from ready to merge).

## Gates (need the founder's yes before the step runs)

- Creating the GitHub repo under `nhunsaker` and the first push (commit/push only when asked).
- Registering the Figma webhook and creating the PAT (external writes, credential creation).
- Any secret placed in GitHub Actions secrets (`FIGMA_TOKEN` for `figma-writeback.yml` is the one v1
  needs; the bridge keeps its tokens locally). Per the standing rule, no founder credential goes into
  GitHub secrets unapproved.
- Copilot coding agent premium-request spend on the recorded run.

## Verification

- `pnpm test:all` green: types, lint, vitest, `build-pack --check`, `check-contract`, storybook test-runner.
- Contract negative tests: a component-tier override in a brand file fails the build; a raw `#hex` in a
  component fails `check-contract` with exit 1; a deleted `pack.json` exits 2; a PR body missing the frame
  link fails `check-pr-contract`.
- Bridge: `pytest bridge/tests` (bad passcode → 401 and nothing written; a `DEV_MODE_STATUS_UPDATE` with
  status ≠ ready → 204 and nothing written; ready → one issue with the label, idempotent on redelivery via
  the `webhook_id + timestamp` key).
- End to end, once: the recorded run in P5, with the dev resource showing on the frame in Dev Mode and the
  merged change visible in Storybook on Pages behind the flag query param.

## Not in this plan

- The FLS ladder itself (wireframe candidates, preview stage, false-advance measurement). This sample has
  one gate, the PR, on purpose. `docs/DECISIONS.md` says what that gives up and points at the case study.
- Seventeen brands, Vue, Cocos. Two brands and React show the tier argument; Cocos is a compile target
  discussion for the room, not code here.
- Judgement-class refuses (near-miss framing, manufactured urgency). Named as the next thing to close.
