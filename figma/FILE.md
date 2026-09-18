# The Figma file

`IDVXk0yZaJ1CQvIZn14AkA`

https://www.figma.com/design/IDVXk0yZaJ1CQvIZn14AkA/figma-design-system-sample

Built 2026-09-18. Five pages, in the order a person meets them.

| Page | What is on it | Link |
|---|---|---|
| Cover | What this is, and the four pages below | `?node-id=5-178` |
| How this works | The six steps, and what happens when a design asks for something the system does not have | `?node-id=5-194` |
| Foundations | Every semantic token as a swatch with the name a developer types, the type scale, the space scale, and the tier rule | `?node-id=0-1` |
| Components | Eleven components, plus Sparkline which is deliberately not in the pack | `?node-id=3-50` |
| Requests | The three frames a designer marks ready | `?node-id=3-51` |

Append a link fragment to the file URL to land on a page.

## Variables

| Collection | Modes | Count | Scopes |
|---|---|---|---|
| Primitives | one | 82 | empty, so none of them appear in any picker |
| Semantic | Harbor, Ember | 49 | narrowed per token, aliased to primitives |

Harbor and Ember are modes of one collection rather than two collections. That is the same
statement the code makes by giving both brands the identical key set: a brand is a set of choices
inside one system, never a second system. Switching the mode moves every swatch, every component
and every frame.

The variables were generated from `design-system/tokens/`, so the file and the repository cannot
drift. Regenerating them is a script, not an afternoon.

## The three request frames

| Frame | What it asks for |
|---|---|
| Player record | The populated screen. Every part of it is in the pack. |
| Player record, no history | The empty state. |
| Roll history | A chart. The pack has no chart. |

`Roll history` is deliberate. It contains a Sparkline, which exists in the file and not in the
pack, so the bridge names it as unmapped and tells the agent not to guess. A demonstration where
nothing fails proves nothing about guardrails.

## Components

Nine of the eleven pack components have a Figma counterpart. `DesignSystem` and `Stack` carry
`figma: null`, because a provider and a layout primitive have no counterpart in a design tool:
auto layout is already Figma's answer to the same question.

## Keeping the key map current

```
FIGMA_FILE_KEY=IDVXk0yZaJ1CQvIZn14AkA pnpm sync:figma
pnpm build:pack
```

The first reads the file and writes `figma/code-connect.json`, one entry per published variant.
The second carries the keys into `design-system/pack.json`. Commit both.

It reads the **file**, not the published library, so nothing has to be published for the pipeline
to work. That removes a step that was only ever a thing to forget.

## Code Connect

Optional, and it changes what a designer sees in Dev Mode rather than what the pipeline can do,
because the pipeline works from the key map above. The template is
`figma/Button.figma.tsx.example`. Copy it per component, replace the node URL, add
`@figma/code-connect` and run `figma connect publish`.
