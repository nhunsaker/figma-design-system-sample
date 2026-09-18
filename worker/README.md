# The bridge, as a Cloudflare Worker

The same service as `bridge/`, with nothing to operate. Pick one. They are held to the same spec
in `contract/` and produce the same issue body byte for byte, so the choice is about where your
credentials live and what you are willing to run, not about what the system does.

| | `bridge/` | `worker/` |
|---|---|---|
| Runs on | a machine you control | Cloudflare |
| Secrets held by | the operating system keychain | Cloudflare, encrypted |
| Costs | whatever the machine costs | nothing at this volume |
| Awake | while the machine is | always |
| A changed pack is live | on the next request | after a redeploy |

## Cost

Cloudflare's free plan is 100,000 requests a day and 10 milliseconds of CPU per invocation. Real
load here is a webhook when a designer marks a frame ready, plus one when a pull request opens or
closes. Tens a day against a hundred thousand. There is no charge for egress or subrequests.

**The limit that could bite is CPU, not requests.** Waiting on Figma and GitHub does not count
against it, only compute does, and ours is a JSON parse and a walk of a few dozen nodes.

`pnpm --filter figma-bridge-worker bench` drives the real reader and the real issue builder
against synthetic frames and prints what one webhook costs:

| Nodes in the frame | Payload | Per request | Share of the 10ms ceiling |
|---:|---:|---:|---:|
| 22 | 1 KB | 0.036 ms | 0.4% |
| 202 | 13 KB | 0.078 ms | 0.8% |
| 1,494 | 96 KB | 0.429 ms | 4.3% |
| 5,281 | 349 KB | 1.374 ms | 13.7% |

Roughly linear in node count, so the ceiling arrives somewhere near 38,000 nodes in a single
frame, which is not a frame anybody draws. A 5,000 node frame, already far larger than anything
in the sample file, spends about a seventh of the allowance.

**Two honest caveats.** The benchmark runs in node, not in workerd, because workerd coarsens its
timers on purpose as a side channel defence and a Worker therefore cannot usefully time itself.
Same V8 underneath, so it is a proxy and not a promise. And Cloudflare reports actual CPU per
invocation in its dashboard, which is the authority: after the first real run, read that number
rather than this table. If it ever crosses the line, the fix is $5 a month, which lifts the
ceiling to 30 seconds.

## Configure

Two values are not secrets and live in `wrangler.toml` under `[vars]`: the file key and the
repository.

Three are secrets and are never in the repository:

```
wrangler secret put FIGMA_TOKEN
wrangler secret put GITHUB_TOKEN
wrangler secret put WEBHOOK_PASSCODE
```

Scopes for each are in `SETUP.md`. They are the same tokens the hosted bridge uses.

**This is the step that differs in kind, not degree.** Those three values now sit in a third
party's configuration rather than in a keychain on a machine you own. That is a different
security posture, and whether it is an acceptable one depends on who can reach your Cloudflare
account. `docs/DECISIONS.md` states it as a trade rather than burying it.

## Deploy

```
pnpm --filter figma-bridge-worker deploy
```

You get `https://figma-bridge.<your-subdomain>.workers.dev`. Then point the webhook at it:

```
pnpm demo:webhook register https://figma-bridge.<subdomain>.workers.dev/figma/webhook
```

That command refuses to register an address nothing answers at, so deploy first.

## Test

```
pnpm --filter figma-bridge-worker test:all
```

Twenty four tests, run in **workerd**, the same runtime the deployed Worker runs in, rather than
in node with a pile of shims. A port whose tests pass somewhere the code will never run has
proved very little.

Against a real `wrangler dev`, with `contract/cases.json` posted at it by curl, the seven cases
that touch no external service answer exactly what the table says: a wrong passcode 401, a missing
one 401, another status 204, another event 204, another file 403, a ping 200, and an unsigned write
back 401. Each under 6ms wall including the first, which pays for the cold start. The other six
cases call Figma or GitHub, so they belong to the suite above, which fakes the network.

They read `contract/cases.json` and `contract/golden/`, which the Python suite also reads. Two of
them diff the issue body byte for byte against the golden. That is the check that keeps the two
runtimes from becoming two systems: the issue body is the entire contract with the agent, so a
word changed in one and not the other hands the agent different instructions depending on which
one read the frame.

## The one behavioural difference

The Python service reads `design-system/pack.json` from disk on every request, so a changed pack
is live on the next one. A Worker has no filesystem, so the pack is bundled at build time and a
changed pack needs a redeploy.

That is the trade for having nothing to operate. It is called out at the top of `src/index.ts` as
well, because that is where somebody changing the code will be.
