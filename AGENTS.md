# Working in this repository

For any agent, and for any person, because a rule only one of them follows is not a rule.

Read `design-system/pack.json` first. It is the whole vocabulary: the components that exist,
the tokens, the rules, and the refusals. Anything not in it does not exist here.

## What you may do

Change files under `src/`. Add a story and a test beside any component you touch. Put every new
feature behind a flag in `src/flags.ts` with its value set to `false`.

## What you may not do

Do not edit anything under `design-system/`. The tokens, the pack and its metadata are reviewed
separately and on a slower clock, because a change there changes every surface at once. If the
work needs a token or a component that does not exist, stop and say so in the pull request
instead of adding one. A blocked task described accurately is more useful than a finished task
that quietly widened the system.

Do not edit `.github/`, and do not change the checks to make your change pass. A check in your
way is either correct, in which case the change is wrong, or wrong, in which case a person
changes it.

Do not turn a flag on.

## The rules you are held to

They are in `pack.json` under `rules`, and the ones a machine checks are under `refuses` with
the check that enforces each one. Five of the six are machine checked. The sixth, that a state
is never carried by colour alone, needs a person, and it is marked that way rather than
pretended about.

In short: every value in a stylesheet is a `var(--ds-*)`. One accented action per screen. Colour
is never the only carrier. Controls are at least 44 pixels and focus is always visible. Figures
are tabular. Motion carries a reduced-motion guard. Only pack components.

## Before you open the pull request

Run `pnpm test:all`. It runs the typecheck, the lint, the pack check, the contract check and the
tests. It is the same gate the pull request runs, so a green run here is a green run there.

If a check fails, read what it said. These checks are written to say what is wrong and what to do
instead. `check-contract` exits 1 when the code is wrong and 2 when the check could not run, and
those are different problems.

## The pull request body

Fill the template in `.github/pull_request_template.md` completely. `check-pr-contract` reads it
and fails if a section is missing, if the frame link is absent, or if the flag you name does not
exist in `src/flags.ts`.

The section that matters most is **Left undone**. Write what you could not do, what you were
unsure about, and anything you changed that you were not asked to change. An empty Left undone
on a task that had a problem in it is the one thing that will lose a reviewer's trust for good.
