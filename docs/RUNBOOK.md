# Runbook

Everything a person has to do, in order, with what each step costs and how to tell it worked.

Steps marked **you** need your hands or your approval. Everything else is already done or can be
done without you.

---

## Where this stands right now

| | |
|---|---|
| Repository | local only, twelve commits, nothing pushed |
| Tests | 93 passing |
| Figma file | built: 11 components, 3 request frames, `IDVXk0yZaJ1CQvIZn14AkA` |
| Figma token | works, all four write scopes confirmed |
| Keychain | all three items present, bridge starts and answers |
| Copilot coding agent | confirmed assignable on `nhunsaker` |
| Bridge | read path tested against the live file, never triggered by a real webhook |
| Webhook | none registered |

Steps 2 is done. Step 1 is the only thing blocking a run.

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

Start the bridge and the tunnel first, then:

```
pnpm demo:webhook register https://your-tunnel-address/figma/webhook
```

It refuses rather than registering if the address is not https, if the host looks like a
placeholder, if the path is wrong, if nothing answers at that address, if the bridge answering
serves a different Figma file, or if this file already has a webhook. Only after all of that does
it read the passcode from the Keychain and register.

That list is not paranoia. The first version of this runbook had a `curl` command with
`YOUR-ADDRESS` in it, and a webhook was registered against the literal string `YOUR-ADDRESS`
within a day. A command that can be pasted verbatim will be pasted verbatim, so the placeholder
is gone and the validation is in code.

**Managing them:**

```
pnpm demo:webhook list
pnpm demo:webhook delete <id>
pnpm demo:webhook delete all
```

**How to tell it worked.** Figma sends a PING immediately and the bridge logs it. If you get no
PING after the command succeeded, the tunnel died between the health check and the registration,
which is rare and fixed by deleting and registering again.

**Scope.** Always the file, never the team. A team webhook wakes the bridge for every file anyone
touches. The command only ever registers file scope, so this is not a decision you have to
remember.

## Step 5 — The first run

**You drive. Twenty minutes, most of it waiting for the agent.**

1. `pnpm demo:status` and confirm it says clean.
2. Open the Figma file, Requests page. Three frames are there:

   | Frame | What it asks for |
   |---|---|
   | Player record | the populated screen, every part of it in the pack |
   | Player record, no history | the empty state |
   | Roll history | a chart the pack does not have |

   Start with **Player record**. Save **Roll history** for the second run, because it is the one
   designed to fail and it is worth watching on purpose rather than by accident.
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

**The Roll history run, when you get to it.** That frame contains a Sparkline, which is a
component in the Figma file that is deliberately not in the pack. The issue names it as unmapped
and tells the agent not to guess. Either it says so honestly under Left undone, which proves the
instructions work, or it invents a chart and `check-contract` refuses the pull request, which
proves the checks work. Both are the demonstration.

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

## What is left after a first run

| | |
|---|---|
| The visual check | a story screenshot against the Figma export, advisory at first |
| A stable address | the virtual machine, so the demo does not depend on a laptop |
| Code Connect proper | optional, changes what a designer sees and not what the pipeline does |

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
| `pnpm demo:webhook list` | what is registered on the file |
