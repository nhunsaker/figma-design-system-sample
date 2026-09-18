# The pull request contract

Five sections, checked by `scripts/check-pr-contract.mjs` on every pull request. The template is
`.github/pull_request_template.md`.

| Section | What it must carry | Why a machine checks it |
|---|---|---|
| Frame | A Figma link with a `node-id` | Review is answering one question, does this match what was asked for. Without the frame nobody can answer it. |
| What changed | A sentence or two, not a file list | The diff already lists the files. |
| Acceptance | The criteria from the issue, each ticked or explained | An unticked box with a reason is useful. A missing list is not. |
| Flag | A flag that exists in `src/flags.ts` | Merging is not releasing. A named flag that does not exist means the change is not actually gated. |
| Left undone | What could not be done, what was unsure, what changed unasked | This is the one that matters. |

## Why Left undone is mandatory

An agent that hits a wall has two options. It can say so, or it can widen the system quietly:
add a component nobody reviewed, loosen a rule, work around a check. The second is invisible in
a diff that otherwise looks fine, and it is the failure that costs a design system its meaning.

Making the field mandatory does not make an agent honest. What it does is remove the excuse that
there was nowhere to put it, and give a reviewer one place to look first. An empty Left undone on
a task that had a problem in it is the thing that loses a reviewer's trust for good, and that is
worth saying to the agent in `AGENTS.md`, which is where it is said.

## What the check does not do

It does not verify that any of it is true. Nothing here could. It makes the claims present and
specific so that a person reading them is reading something answerable, rather than a paragraph
of confident prose that could mean anything.

That distinction is the whole design. A check that claimed to verify an agent's report would be
the most dangerous check in the repository, because everyone would believe it.
