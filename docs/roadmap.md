# What is built, and what is left

## Built

The design system as a contract: three token tiers, two brands, the compiler that enforces the
tier rule and the contrast floor, and `pack.json`.

Six components with stories and tests, the page that uses them, and the flag module.

The two checks, with the tests that break the repository on purpose to watch each one refuse it.

The bridge, with fake networks in its tests so the whole thing runs offline. It exists twice: in
Python for a machine you control, and in TypeScript as a Cloudflare Worker for people who would
rather operate nothing. Both are held to `contract/`, an executable spec both test suites read,
and the Worker's tests run in workerd rather than in node, because a port whose tests pass
somewhere the code will never run has proved very little.

The workflows: the gate, the write back over OIDC, and the Pages deploy.

The Figma file, built 2026-09-18: 81 primitive variables, 47 semantic variables with Harbor and
Ember as two modes of one collection, six components with variants, and two request frames built
only from instances. The component keys are synced into the pack.

The demo is repeatable. `pnpm demo:status` says what state the loop is in and `pnpm demo:reset`
returns Figma and the repository to the state they were in before anyone marked a frame ready. A
demonstration you can only give once is a demonstration you will get wrong in front of people.

The component library underneath the pack is `@metatoy/bootstrap-styled`, wired through its
runtime custom properties so a brand change re-skins it without a rebuild. It may be imported in
`src/components` and nowhere else, which is checked.

`docs/architecture.html` is the drawing of the whole thing, and `docs/images/architecture.png`
is the render of it that the README shows.

## Left

**The webhook.** One call, in `bridge/README.md`. It needs a public address for the bridge, which
is either a tunnel, a machine, or a Worker deploy.

**The Worker has never been deployed.** Everything about it is proved locally against the same
contract the Python service passes, and nothing about it has met the real internet. The deploy is
gated on three `wrangler secret put` commands, which move credentials into a third party's
configuration and are therefore the founder's call, not mine.

**A recorded run.** Mark a frame, watch the issue open, let the agent build it, approve, merge,
and see the pull request appear on the frame. Screenshots into `docs/images/`.

**The visual check.** A story screenshot compared against the Figma export, commenting on the
pull request. Advisory until its false positive rate on real pull requests earns otherwise. See
`DECISIONS.md`.

**Code Connect proper.** Optional. It changes what a designer sees in Dev Mode and changes
nothing about what the pipeline can do, because the pipeline works from the key map, which is
read from the file itself and needs no library publish.

**Reset coverage for the GitHub half.** `demo.mjs reset` closes issues and pull requests through
the `gh` CLI, and that half is written but unexercised until the repository exists. The Figma
half is exercised.

The three request frames: the populated record, the empty state, and Roll history, which asks
for a chart the pack does not have. That third one is deliberate. A demonstration where nothing
fails proves nothing about guardrails, so one frame asks for something real that the system
cannot express, and the run gets to show what honest looks like.
