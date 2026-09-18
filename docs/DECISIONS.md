# Decisions, and what each one gives up

Every entry names the thing the decision costs. A decision record with no cost in it is an
advertisement.

## One gate, not five

The pipeline has a single human gate, the pull request. An earlier system of mine measures what
happens with more gates than that, and the number is worth knowing: across five clean runs, 27
seeds and three products, roughly one in ten agent steps advanced in a wrong direction, and 13
of 14 deliberately wrong directions were caught at or before the step where they were knowable.

**What one gate gives up.** A wrong direction is discovered at the pull request, which is the
most expensive place to discover it. Everything between the frame and the diff happened without
anyone looking.

**Why it is still right here.** Small tasks, scoped to one frame, with the design attached to
the issue, make a wrong direction cheap to throw away. Adding a wireframe gate before the build
would be building the interesting system rather than the smallest one that works, and the honest
version of this repository is the smallest one that works.

## Copilot, not a model key in the repository

The coding agent is GitHub's, so no model credential lives here. Claude Code in Actions would be
the alternative and it needs an API key as a repository secret.

**What it gives up.** Less control over the agent's behaviour and no ability to swap models by
task. A secret in the repository is the price of that control, and it is a price worth paying
later and not at the start.

## OIDC, not a repository secret, for the write back

The write back workflow proves who it is with a short lived GitHub token rather than carrying a
Figma token.

**What it gives up.** More moving parts than a secret, and a bridge that must be reachable from
GitHub's runners. In exchange there is no long lived credential that every current and future
workflow in this repository can read, which is the failure mode that actually happens.

## Two brands, not seventeen

Two is the smallest number that demonstrates the tier rule. The seventeenth brand adds a
governance problem, not a technical one.

**What it gives up.** Nothing about whether the approach scales is proven here. The tier rule
and the identical key set are the mechanism, and they do not get harder with more brands. What
gets harder is deciding who owns a semantic key that only one brand wants, and that is a
conversation, not a build step.

## React, not a second runtime

A game engine or a second framework would need the tokens compiled to engine values rather than
custom properties.

**What it gives up.** The claim that this compiles anywhere is untested here. The design is that
the semantic decision is the artifact and the custom property is one target, which is why the
tokens are DTCG and the compiler is forty lines. Adding a target is adding an emitter. That is
the claim, and it is a claim rather than a demonstration.

## The visual check is advisory

A story screenshot compared against the Figma export comments on the pull request rather than
blocking it.

**What it gives up.** A change can look wrong and still merge. The reason is that a blocking
check with a false positive rate people learn to ignore is worse than an advisory one they read,
because the first one teaches everybody to click through blocking checks. It becomes blocking
when its rate on real pull requests earns it, and `operating-model.md` says so.

## One refusal needs a person, and says so

Five of the six refusals in the pack are machine checked. The sixth, that a state is never
carried by colour alone, is marked `enforced_by: review`.

**What it gives up.** The clean claim that the ethics of this design system are enforced. They
are not, entirely. They are machine readable and they reach the agent, and five of six are
machine checked, and the sixth needs a person.

Saying that costs nothing and buys the only thing that matters here, which is that the other
five claims can be believed. A rule that claims a machine checks it when none does is worse than
no rule, because the first thing anyone does with a compliance story is ask what enforces it.

## Wrapping a runtime-styled library costs one extra class everywhere

The vendor library is styled-components, so its rules are injected at runtime and land after
this repository's static stylesheets. At equal specificity the later rule wins, which means a
single class in a wrapper loses every argument to the vendor's own declarations. Every modifier
in `Stack.css` doubles its class to reach 0,2,0.

**What it gives up.** Selectors that are uglier than they should be, and a rule every future
wrap has to remember. The alternative was `!important`, which wins the same argument and loses
the next one.

**What it cost to learn.** The stack classes were all present in the served stylesheet and none
of them applied. Ninety five tests were green. A person looking at the running page saw four
figures sitting on top of each other in about ten seconds, and it took three attempts to fix
because the first two were reasoning about the cascade rather than reading it in the browser.

That is the honest case for the visual check, and for the rule that a change is not shipped
until somebody has looked at it.

## A component could still be built in the shell

`check-contract` fences `src/components`: nothing appears there without the pack listing it, and
no file outside it may carry its own component stylesheet. Someone determined could still add
classes to `src/app.css` and build a component in the page shell.

**What it gives up.** The fence is not a wall. It stops the accident and the shortcut, not the
person who has decided to route around it. That is the right amount of enforcement for a design
system, because the alternative is a build system nobody can work in, and the token rules still
apply to every line of that stylesheet.
