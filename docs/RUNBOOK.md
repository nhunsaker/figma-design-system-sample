# Runbook

Everything a person has to do, in order, with what each step costs and how to tell it worked.

Steps marked **you** need your hands or your approval. Everything else is already done or can be
done without you.

---

## Where this stands right now

| | |
|---|---|
| Repository | local only, 8 commits, nothing pushed |
| Tests | 91 passing |
| Figma file | built, `IDVXk0yZaJ1CQvIZn14AkA` |
| Figma token | works, all four write scopes confirmed |
| Copilot coding agent | confirmed assignable on `nhunsaker` |
| Bridge | written and tested, never run against the real world |
| Webhook | none registered |

---

## Step 1 — Create the repository and push

**You approve, then it is one command.**

```
gh repo create nhunsaker/figma-design-system-sample --public --source . --push
```

Then branch protection, so the agent can open a pull request and never merge one:

```
gh api -X PUT repos/nhunsaker/figma-design-system-sample/branches/main/protection \
  --input .github/branch-protection.json
```

**How to tell it worked.** The `verify` workflow runs on the first push and goes green. If it
goes red, read which job failed: a red `bridge` job means Python, a red `verify` job means the
front end, and both run the same commands you can run locally.

**What this unblocks.** Everything. The agent cannot be assigned an issue in a repository that
does not exist.

---

## Step 2 — Two Keychain items

**You, two commands, about a minute.**

The bridge reads every secret from the login Keychain at start up. There is no `.env` file
anywhere in this project and there should never be one.

```
security add-generic-password -a "$USER" -s figma-bridge-webhook-passcode -w
security add-generic-password -a "$USER" -s figma-bridge-github-token -w
```

Each prompts for the value, twice, without echoing it.

**The passcode** is a random string you invent. Figma sends it back on every webhook delivery and
the bridge compares it. Generate one with `openssl rand -hex 24` and paste it. You need it again
in step 4, so keep it in the clipboard until then.

**The GitHub token** is a fine-grained personal access token scoped to this one repository. Create
it at github.com/settings/personal-access-tokens with:

| Permission | Level | Why |
|---|---|---|
| Issues | Read and write | open the issue, label it, comment |
| Pull requests | Read and write | read what happened to it |
| Contents | Read | nothing else needs writing |

Do not give it Administration, Actions, or anything on other repositories. If the bridge is ever
compromised, this token is the whole blast radius.

**What you already have.** `sorb-figma-api-token` exists and works. It reads the file, writes dev
resources, writes comments and registers webhooks. All four were tested.

**How to tell it worked.**

```
cd bridge && FIGMA_FILE_KEY=IDVXk0yZaJ1CQvIZn14AkA uv run figma-bridge
```

It starts and prints nothing alarming. Then in another terminal, `curl localhost:8787/health`
returns the file key and the repository name.

---

## Step 3 — Give the bridge a public address

**A decision, then either two minutes or twenty.**

Figma has to be able to reach the bridge. Two ways, and they suit different moments.

### While building: a tunnel

```
brew install cloudflared
cloudflared tunnel --url http://localhost:8787
```

It prints a URL. Free, no account, up in seconds. The URL changes every time you restart it,
which means re-registering the webhook every time, which is the reason not to use it for the
real thing.

### For the interview: the existing virtual machine

The harness already runs on that box behind Caddy with public DNS. A second unit and a route at
something like `bridge.n8plusus.com` gives a stable address that survives a closed laptop.

It means two secrets in that machine's environment file, which is the same standing you already
accepted for the harness passcode. **This is a gate: I will not put them there without you
saying so.**

**Recommendation.** Tunnel now, machine before the session. Do not demo from a laptop that has to
stay awake and online.

---

## Step 4 — Register the webhook

**You approve, then one command.**

```
curl -X POST https://api.figma.com/v2/webhooks \
  -H "X-Figma-Token: $(security find-generic-password -a "$USER" -s sorb-figma-api-token -w)" \
  -H 'Content-Type: application/json' \
  -d '{"event_type":"DEV_MODE_STATUS_UPDATE","context":"file",
       "context_id":"IDVXk0yZaJ1CQvIZn14AkA",
       "endpoint":"https://YOUR-ADDRESS/figma/webhook",
       "passcode":"THE-PASSCODE-FROM-STEP-2"}'
```

Scope it to the **file**, never the team. A team webhook wakes the bridge for every file anyone
touches.

**How to tell it worked.** Figma sends a PING immediately. The bridge logs it and answers 200. If
you get no PING, the endpoint is not reachable from the internet, which is a tunnel problem and
not a Figma problem.

**Check what is registered:**

```
pnpm demo:status
```

**A warning from experience.** Posting to this endpoint creates a webhook. There is no dry run. I
made exactly this mistake while testing scopes and had to delete one within the minute.

---

## Step 5 — The first run

**You drive. Twenty minutes, most of it waiting for the agent.**

1. `pnpm demo:status` and confirm it says clean.
2. Open the Figma file, Requests page, select **Empty state**.
3. In Dev Mode, set its status to **Ready for development**.
4. Within seconds an issue appears, labelled `design:ready`, carrying the frame image, the
   components it is made of, the words in it, and the acceptance list. It is assigned to Copilot.
5. The agent opens a draft pull request. This takes a few minutes.
6. Checks run. Watch which ones fail, because that is the interesting part.
7. Review it. Approve or request changes.
8. On merge, the pull request appears on the frame in Dev Mode as a dev resource.

**If nothing happens at step 4.** Check the bridge log first. A wrong passcode logs a refusal and
writes nothing, which is the correct behaviour and looks identical to being down. `pnpm
demo:status` tells you whether the webhook is still registered.

**If the agent produces something wrong.** That is a good outcome and worth keeping. Screenshot
the failing check before you fix anything.

---

## Step 6 — Reset, and run it again

**One command, plus two clicks no API can do.**

```
pnpm demo:reset
```

It unpins the dev resources, deletes the comments the bridge left, closes the issue and the pull
request, and deletes the branch. It does not touch the components, the frames, the variables, or
anything merged.

Then, in Figma, set the frame's status back to none. Figma's REST surface can read that a frame
is ready and cannot mark one anything, so this step is yours. Marking it ready again starts the
next run.

Run `pnpm demo:reset --dry-run` first if you want to see what it would do.

---

## What I still owe you

| | |
|---|---|
| The Stats screen | components are built, the screen and its Figma frame are not |
| A frame designed to fail | the most valuable fifteen minutes left, see below |
| The visual check | story screenshot against the Figma export, advisory |

**The frame designed to fail** matters more than it sounds. The two frames that exist are clean
enough that the agent will probably produce a passing pull request first time, and a demonstration
where nothing fails proves nothing about guardrails. A third frame asking for something the pack
cannot express gives you either the agent saying so honestly, which proves the instructions work,
or a refused pull request, which proves the checks work.

---

## Commands worth memorising

| | |
|---|---|
| `pnpm test:all` | the same gate the pull request runs |
| `pnpm demo:status` | what state the whole loop is in |
| `pnpm demo:reset` | put Figma and the repository back |
| `pnpm storybook` | the components, with a brand switcher |
| `pnpm pack` | rebuild the design pack after a token change |
| `pnpm sync:figma` | re-read component keys after changing the Figma file |
