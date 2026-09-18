# What is built, and what is left

## Built

The design system as a contract: three token tiers, two brands, the compiler that enforces the
tier rule and the contrast floor, and `pack.json`.

Six components with stories and tests, the page that uses them, and the flag module.

The two checks, with the tests that break the repository on purpose to watch each one refuse it.

The bridge, with fake networks in its tests so the whole thing runs offline.

The workflows: the gate, the write back over OIDC, and the Pages deploy.

## Left

**The Figma file.** `figma/FILE.md` says what to build. Everything downstream is written and
tested against fixtures, so the file is the only thing standing between here and a real run.

**The key sync.** One command once the library is published, then commit what it writes.

**The webhook.** One call, in `bridge/README.md`. It needs the file key.

**A recorded run.** Mark a frame, watch the issue open, let the agent build it, approve, merge,
and see the pull request appear on the frame. Screenshots into `docs/images/`.

**Code Connect proper.** Optional. It changes what a designer sees in Dev Mode and changes
nothing about what the pipeline can do, because the pipeline works from the key map.

**The visual check.** A story screenshot against the Figma export, commenting on the pull
request. It needs the file to exist before it can be written honestly, and it stays advisory
until its false positive rate earns otherwise. See `DECISIONS.md`.
