# Build Empty state on Requests

<!-- figma-bridge:AbC123XyZ:41:207 -->

A designer marked **Empty state** ready for development.

[Open the frame in Figma](https://www.figma.com/design/AbC123XyZ/?node-id=41-207)

## What the frame is made of

- `Button` from the design pack
- **Avatar** — not mapped to a pack component
- **Timeline** — not mapped to a pack component

> Some of this frame is not mapped to code. Do not guess which component was meant.
> If the design needs something the pack does not have, say so in the pull request
> under Left undone and build the part you are sure about.

## The words in the frame

Use these exactly. Copy is a design decision.

- No frames are ready yet.
- Open the Figma file

## Acceptance

- [ ] The change matches the frame
- [ ] Only components from the design pack are used
- [ ] A story covers the new state
- [ ] `pnpm test:all` passes
- [ ] The change is behind a flag in `src/flags.ts`, set to `false`

## Before you start

Read `design-system/pack.json` (`DSS-1.0`) and `AGENTS.md`. The pack is the whole
vocabulary and the checks enforce it, so building to the pack is faster than building
around it.