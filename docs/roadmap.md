# What is built, and what is left

## Built

The design system as a contract: three token tiers, two brands, the compiler that enforces the
tier rule and the contrast floor, and `pack.json`.

Six components with stories and tests, the page that uses them, and the flag module.

The two checks, with the tests that break the repository on purpose to watch each one refuse it.

The bridge, with fake networks in its tests so the whole thing runs offline.

The workflows: the gate, the write back over OIDC, and the Pages deploy.

The Figma file, built 2026-09-18: 81 primitive variables, 47 semantic variables with Harbor and
Ember as two modes of one collection, six components with variants, and two request frames built
only from instances. The component keys are synced into the pack.

The demo is repeatable. `pnpm demo:status` says what state the loop is in and `pnpm demo:reset`
returns Figma and the repository to the state they were in before anyone marked a frame ready. A
demonstration you can only give once is a demonstration you will get wrong in front of people.

## Left

**The webhook.** One call, in `bridge/README.md`. It needs a public address for the bridge.

**A recorded run.** Mark a frame, watch the issue open, let the agent build it, approve, merge,
and see the pull request appear on the frame. Screenshots into `docs/images/`.

**Code Connect proper.** Optional. It changes what a designer sees in Dev Mode and changes
nothing about what the pipeline can do, because the pipeline works from the key map, which is
read from the file itself and needs no library publish.

**Reset coverage for the GitHub half.** `demo.mjs reset` closes issues and pull requests through
the `gh` CLI, and that half is written but unexercised until the repository exists. The Figma
half is exercised.

**The visual check.** A story screenshot against the Figma export, commenting on the pull
request. It needs the file to exist before it can be written honestly, and it stays advisory
until its false positive rate earns otherwise. See `DECISIONS.md`.
