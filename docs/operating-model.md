# How this is run

The technical design is the easy half. This is the half that decides whether anyone keeps using
it a year later.

## Who may change what

| Layer | Who | How often | What it costs to get wrong |
|---|---|---|---|
| Primitive tokens | the core team | rarely | everything, at once |
| Semantic tokens | a brand, for its own file | when the brand changes | that brand, everywhere |
| Component tokens | the core team | when a component changes | every brand, at once |
| Components | anyone, by pull request, reviewed by the core team | weekly | every surface using it |
| `src/` | anyone, including an agent | continuously | one feature, behind a flag |

The rule that does the work: **a brand that needs a component-tier override has found a bug in
the component.** Adding the override forks the component quietly. Fixing the component fixes it
for everyone. The build enforces this rather than a reviewer arguing it, which matters because
the reviewer loses that argument at four in the afternoon on a Friday.

## Autonomy is a dial, and it starts low

The agent's blast radius today is one pull request on one branch, with every check blocking and
a person approving. That is the right place to start and the wrong place to stay.

What widens it, in order, each only after the evidence says so:

1. **The visual check becomes blocking** once its false positive rate on real pull requests is
   low enough that people stop ignoring it. Advisory now, deliberately, because a noisy blocking
   check trains everyone to click through blocking checks.
2. **Draft becomes ready** when the agent's pull requests stop needing a first round of changes
   for contract reasons. That is measurable and it is the honest signal.
3. **Small, well described changes merge on a green build with a lighter review** once there is
   a class of change with a track record. Never the design system, never the checks.

What never widens: the agent does not edit `design-system/`, does not edit `.github/`, does not
turn a flag on, and does not merge its own pull request. Those are not trust questions. They are
blast radius questions, and the answer does not change as trust grows.

## What to count

Four numbers, and they are worth more than any of the architecture:

- **Pull requests per frame.** More than one means the issue did not carry enough. Fix the
  issue, not the agent.
- **Which check failed, by class.** Contract failures mean the pack is unclear or the agent is
  guessing. Test failures mean something else. They need different fixes and lumping them
  together hides both.
- **Time from ready to merged.** The number a designer feels. If it is worse than doing it by
  hand, none of the rest matters.
- **Changes that reached production behind a flag that was never turned on.** Work nobody
  wanted, built anyway. The most expensive number here and the one nobody measures.

## Adoption, when a team does not want this

Three things, in this order.

**Make the paved road faster than the alternative.** Nobody adopts a slower correct thing. If
building to the pack is slower than building around it, the pack loses, and it should.

**Let the gate be machine run rather than taste run.** Most resistance to a design system is
resistance to a person's opinion. A check that says this component is not in the pack is not an
opinion, and it does not get into an argument.

**Let results recruit.** One workflow where the step is already wanted, made excellent,
instrumented and visible. Do not roll out. Wait for the second team to ask.
