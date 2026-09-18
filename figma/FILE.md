# The Figma file

This repository expects one Figma file with two pages. Nothing here reads it at build time, so
the file can arrive after the code, and the code is tested without it.

## What to build

**Page one, Components.** Six components, each a real Figma component with auto layout and
layers named for their role. Variants where the pack lists them:

| Component | Variants | Matches |
|---|---|---|
| Button | variant primary and secondary, size default and compact, plus a disabled state | `src/components/Button.tsx` |
| Badge | tone neutral, success, warning, danger | `src/components/Badge.tsx` |
| Card | with and without a footer | `src/components/Card.tsx` |
| Input | default and invalid | `src/components/Input.tsx` |
| Tabs | two, three and four tabs | `src/components/Tabs.tsx` |
| Toast | tone neutral, success, danger | `src/components/Toast.tsx` |

Use the token values from `design-system/tokens.harbor.css`. Figma variables are the neat way to
do it and a flat set of styles is fine for a sample. The names must match the pack, because the
key sync script matches on name.

Publish page one as a library. Nothing works until it is published, because an unpublished
component has no stable key.

**Page two, Requests.** Two frames built only from those components. These are what a designer
marks ready for development. Give them names a person would use, such as Empty state and
Filter bar.

## Then

```
FIGMA_FILE_KEY=<key> pnpm sync:figma
pnpm pack
```

The first reads the published library and writes `figma/code-connect.json`. The second carries
the keys into `design-system/pack.json`. Commit both. Until that happens the bridge reports
every instance in a frame as unmapped, which is honest and is why the issue it writes says so.

The file key is in the URL, between `/design/` and the file name. It is not a secret and it is
recorded here once the file exists.

**File key:** not yet created.

## Code Connect

`pnpm sync:figma` gives the bridge what it needs. Code Connect proper, which puts a real code
snippet in Dev Mode next to each component, is a separate step and needs a paid seat. The
template is in `figma/Button.figma.tsx.example`. Copy it per component, replace the node URL,
add `@figma/code-connect` and run `figma connect publish`.

It is worth doing because it changes what a designer sees, not what the pipeline can do. The
pipeline already works from the key map.
