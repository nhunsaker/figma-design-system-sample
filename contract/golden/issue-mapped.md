# Build Empty state on Requests

<!-- figma-bridge:AbC123XyZ:41:207 -->

A designer marked **Empty state** ready for development.

[Open the frame in Figma](https://www.figma.com/design/AbC123XyZ/?node-id=41-207)

## What the frame is made of

- `Button` from the design pack
- **Avatar** — not mapped to a pack component (48 by 48)
- **Timeline** — not mapped to a pack component (672 by 80)

> Some of this frame is not mapped to code. Do not guess which component was meant.
> Use `Missing` from the pack for each one, passing the name and the size above, and
> build the rest of the frame normally. Say what you used it for in the pull request
> under Left undone.

## How the frame is arranged

Top to bottom, as the designer placed it. Build it in this order.

- "No frames are ready yet."
- a row of:
  - `Button` x 3
- **Avatar**
- a column of:
  - "Stacked, not side by side."
  - **Avatar**
- **Timeline**

## The words in the frame

Use these exactly. Copy is a design decision.

- No frames are ready yet.
- Open the Figma file
- Stacked, not side by side.

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