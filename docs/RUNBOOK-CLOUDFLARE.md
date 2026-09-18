# Runbook: running the bridge on Cloudflare

The other way to give Figma an address to call. `docs/RUNBOOK.md` is the main sequence and this
replaces one step of it, Step 3, the one about a tunnel or a machine. Everything before it is the
same and everything after it is the same.

Steps marked **you** need your hands or your approval. There are more of those here than usual,
and the reason is the next section.

---

## Read this before you start

This path puts three credentials into a third party's configuration. That is the whole trade and
it is worth being blunt about it rather than discovering it at Step 2.

| | The machine | Cloudflare |
|---|---|---|
| Your Figma token lives in | the login Keychain, on hardware you own | Cloudflare, encrypted |
| Reaching it requires | your machine and your login | your Cloudflare account |
| You operate | a process, an address, something kept awake | nothing |
| A changed pack goes live | on the next request | after a redeploy |
| Cost | whatever the machine costs | nothing at this volume |

Nothing else differs. Both are held to `contract/` and both produce the same issue body byte for
byte, which is checked rather than asserted.

**The last row of the top half is the one you cannot undo later without rotating tokens.** If the
answer is no, close this file and use `docs/RUNBOOK.md` Step 3 instead. Nothing here is required.

---

## Where this stands right now

| | |
|---|---|
| The Worker | written, 24 tests passing in workerd, typecheck clean |
| Held to the spec | yes, the same `contract/cases.json` the Python service passes |
| Proved locally | 7 of 13 cases posted at a real `wrangler dev`, all matching |
| CPU measured | 0.036ms to 1.4ms across frames of 22 to 5,281 nodes |
| Deployed | **no. It has never met the real internet** |
| Cloudflare account | none created |
| Secrets at Cloudflare | none set |

The six cases not proved locally call Figma or GitHub, so they need real credentials and belong
to the test suite, which fakes the network and covers all thirteen.

---

## Step 0 — Upgrade wrangler

**Not you. One command, and worth doing before anything else.**

```
pnpm --filter figma-bridge-worker add -D wrangler@4
```

The pinned version is 3.114.17, which prints `The version of Wrangler you are using is now
out-of-date` on every run and whose bundled runtime does not know this Worker's compatibility
date of 2026-09-01. Locally it silently falls back to an older runtime and says so. That is
survivable for `wrangler dev` and it is not something to carry into a deploy.

**How to tell it worked.** `pnpm --filter figma-bridge-worker exec wrangler --version` says 4,
and `pnpm test:worker` is still 24 passing. If the tests break, the upgrade is the suspect and
reverting it costs nothing, because nothing has been deployed yet.

---

## Step 1 — A Cloudflare account, and a login

**You. Interactive, and it opens a browser.**

Create a free account at `dash.cloudflare.com` if you do not have one. No card, no plan choice.
The free tier is 100,000 requests a day and 10 milliseconds of CPU per invocation, against a real
load of tens of requests a day.

Then, from the repository:

```
pnpm --filter figma-bridge-worker exec wrangler login
```

It opens a browser, you approve the scopes, and it writes a token under your home directory. I
cannot do this part and would not want to: it is an interactive grant of write access to your
Cloudflare account.

**How to tell it worked.**

```
pnpm --filter figma-bridge-worker exec wrangler whoami
```

It prints the account email and the account identifier. If it prints nothing useful, the login
did not complete and running it again is safe.

**What this unblocks.** Steps 2 and 3, and nothing else. Logging in publishes nothing and creates
no Worker.

---

## Step 2 — The three secrets

**You approve. This is the gate.**

These are the same three values the Python service reads from the Keychain, so nothing new is
being created. What changes is where a copy of them lives.

Pipe them out of the Keychain rather than typing or pasting them, so no secret ever appears in a
command line, in your shell history, or on screen:

```
cd worker
security find-generic-password -a "$USER" -s sorb-figma-api-token -w | npx wrangler secret put FIGMA_TOKEN
security find-generic-password -a "$USER" -s figma-bridge-github-token -w | npx wrangler secret put GITHUB_TOKEN
security find-generic-password -a "$USER" -s figma-bridge-webhook-passcode -w | npx wrangler secret put WEBHOOK_PASSCODE
```

The passcode has to be the same one the existing webhook was registered with, or Figma's
deliveries get a 401 and nothing happens. Reusing the Keychain value is what guarantees that,
which is the second reason to pipe rather than retype.

If a pipe is refused by your wrangler version, run each command without the pipe and paste at the
prompt. Wrangler hides the input.

**How to tell it worked.**

```
npx wrangler secret list
```

Three names, no values. Cloudflare will not show you a secret after it is set, which is correct
and means a typo is fixed by setting it again rather than by reading it back.

**What this costs.** Your Figma token now exists in two places. Whoever can reach your Cloudflare
account can use it. If that account is not protected with two factor authentication, turn that on
before this step rather than after.

---

## Step 3 — Deploy

**You approve. This publishes a public endpoint.**

```
pnpm --filter figma-bridge-worker deploy
```

On a fresh account the first deploy asks you to pick a `workers.dev` subdomain. It is permanent
for the account and it becomes part of the address, so pick something you would not mind reading
out loud.

You get back `https://figma-bridge.<your-subdomain>.workers.dev`.

**How to tell it worked.**

```
curl https://figma-bridge.<your-subdomain>.workers.dev/health
```

It answers with the file key and the repository:

```
{"ok":true,"file":"IDVXk0yZaJ1CQvIZn14AkA","repo":"nhunsaker/figma-design-system-sample"}
```

That is the same answer the Python service gives, and if it comes back with a different file key
then the wrong `wrangler.toml` was deployed.

**What is now true.** There is a public address on the internet that anyone can post to. It
refuses everything that does not carry the passcode, refuses any payload naming a file it does
not serve, and cannot be told which file to read, because the file is in its own configuration
and not in the request. Those refusals are seven of the thirteen cases in `contract/cases.json`,
they were posted at a real `wrangler dev` before any of this was deployed, and they are the reason
this is a reasonable thing to publish.

---

## Step 4 — Re-point the webhook

**You approve, then one command.**

The existing webhook points at the tunnel or the machine. Move it:

```
pnpm demo:webhook list
pnpm demo:webhook delete all
pnpm demo:webhook register https://figma-bridge.<your-subdomain>.workers.dev/figma/webhook
```

Register refuses rather than registering if the address is not https, if the host looks like a
placeholder, if the path is wrong, if nothing answers there, if whatever answers serves a
different Figma file, or if this file already has a webhook. That last one is why the delete comes
first.

**How to tell it worked.** Figma sends a PING immediately. Watch for it:

```
pnpm --filter figma-bridge-worker exec wrangler tail
```

A live log of the deployed Worker. The PING appears as a 200 within a second or two. Leave this
running for the first real run, because it is the only window you have into what the Worker is
doing.

**Scope is always the file, never the team.** A team webhook wakes the service for every file
anybody touches. The command only ever registers file scope, so this is not something you have to
remember.

---

## Step 5 — One real run

**You drive. Twenty minutes, most of it waiting for the agent.**

Identical to `docs/RUNBOOK.md` Step 5 and repeated here so you are not reading two files at once.

1. `pnpm demo:status` and confirm it says clean.
2. Open the Figma file, Requests page, and pick **Player record**. Save **Roll history** for a
   second run, because it is the frame designed to fail and it is worth watching on purpose.
3. In Dev Mode set its status to **Ready for development**.
4. Within seconds an issue appears labelled `design:ready`, carrying the frame image, the
   components it is made of, the words in it, and the acceptance list, assigned to the agent.
5. The agent opens a draft pull request. A few minutes.
6. Checks run. Watch which ones fail, because that is the interesting part.
7. Review. Approve or request changes.
8. On merge the pull request appears on the frame in Dev Mode as a dev resource.

**What to watch in `wrangler tail`.** One inbound 200 at the start, and a second one later when
the pull request opens and the write back door is used. If the first arrives and the second never
does, the problem is the write back workflow and not the Worker.

---

## Step 6 — Reset

**You, one command, and it is the reason this demo can be given twice.**

```
pnpm demo:reset
```

Unpins the dev resources, deletes the comments the service left, and closes the issue, the pull
request and its branch. It does not touch the components, the frames, or anything merged.

Setting the frame's status back to none is the one step no API can do. Figma can report that a
frame is ready and cannot mark one anything, which is the right place for that line.

---

## Going back to the machine

Nothing here is one way.

```
pnpm demo:webhook delete all
pnpm demo:webhook register https://your-tunnel-or-machine/figma/webhook
```

The Python service still works and still reads the Keychain. The Worker can be left deployed and
unused at no cost, or deleted:

```
pnpm --filter figma-bridge-worker exec wrangler delete
```

**Deleting the Worker deletes its secrets with it.** If you are stepping back because you changed
your mind about where the credentials live, that is the command that acts on it, and rotating the
Figma token afterwards is the thorough version.

---

## When something does not happen

**Nothing happens when you mark a frame ready.** Check `wrangler tail` first. A wrong passcode
logs a refusal and writes nothing, which is correct behaviour and looks exactly like being down.
If no request arrives at all, `pnpm demo:webhook list` says whether the webhook still exists and
at which address.

**Every delivery is a 401.** The passcode at Cloudflare is not the one the webhook was registered
with. Set it again from the Keychain and re-register. There is no way to read either back and
compare, by design, so the fix is to make both come from the same place rather than to inspect
them.

**The issue opens but every component is unmapped.** The pack the Worker is carrying is stale.
This is the one real behavioural difference: the Python service reads `pack.json` from disk on
every request, and a Worker has no filesystem, so the pack is bundled at build time. Run
`pnpm pack`, commit it, and deploy again.

**A 500 on the health check.** A secret is missing. `wrangler secret list` shows which three
should be there.

**It worked yesterday and today it does not.** Check whether the Figma token expired. That is the
same failure the machine has, and nothing about Cloudflare changes it.

---

## What this will cost

Nothing, at any plausible load for this.

| | Free plan | What this uses |
|---|---|---|
| Requests | 100,000 a day | tens |
| CPU per invocation | 10 milliseconds | 0.036ms to 1.4ms measured |
| Egress | not charged | not charged |

The measured range comes from `pnpm --filter figma-bridge-worker bench`, which drives the real
frame reader against synthetic frames from 22 to 5,281 nodes. It measures in node rather than in
workerd, because workerd coarsens its timers on purpose and a Worker cannot usefully time itself.
Cloudflare reports actual CPU per invocation in its dashboard, so after the first real run that is
the number to read.

If CPU ever became the problem, the paid plan is five dollars a month and lifts the ceiling to
thirty seconds. Nothing here is close to needing it.
