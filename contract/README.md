# The contract

What the bridge does, as data, so that two implementations of it cannot quietly become two
different systems.

Two runtimes are held to this directory:

| | |
|---|---|
| `bridge/` | Python and FastAPI, run on a machine you control |
| `worker/` | TypeScript on Cloudflare Workers, nothing to operate |

## The rule

**Change this directory before changing either implementation.** Not after, and not instead of.
A behaviour that is true in one runtime and not the other is worse than a behaviour neither has,
because it depends on where a webhook happened to land.

## What is in here

**`cases.json`** is the behaviour table. Each case is an inbound request and the expected outcome:
the status code, and the set of writes that should have happened. Most of the cases are ones where
nothing should happen, which is deliberate. A webhook that acts when it should not is worse than
one that is down, because the first failure is quiet and lands in somebody else's repository.

The expectation names writes by kind rather than by URL, so each implementation can spell a
request the way its own client spells it and still be held to the same behaviour.

**`golden/`** is the exact issue body, byte for byte. It matters more than it looks: the issue is
the entire contract with the agent, so a word changed in one runtime and not the other means the
agent is given different instructions depending on which runtime read the frame.

**`fixtures/`** are recorded API responses, so both suites run offline and neither needs a live
design connection to prove itself.

## Changing the wording

```
cd bridge && UPDATE_GOLDEN=1 uv run pytest -k golden
```

Then read the diff. If it is larger than you meant, that is what the file is for. Make the same
change in the Worker before you commit, or the next run of either suite will tell you.
