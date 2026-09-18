# Setup

Everything you need to configure to run this yourself, in the order it has to happen.

If you only want to look at the components, skip to [Local](#local) and stop there. The Figma and
GitHub configuration below only matters if you want the whole loop to run.

---

## What holds which credential

Read this before creating anything, because it is the reason the setup is shaped the way it is.

| | Figma token | GitHub token |
|---|---|---|
| The bridge, on your machine or your server | yes, one | yes, scoped to one repository |
| The coding agent, on GitHub | no | its own, issued by GitHub for that run |
| Any workflow in this repository | no | its own, issued by GitHub per job |

There is no `.env` file in this project and there should never be one. The bridge reads its two
secrets from the operating system keychain at start up and holds them in memory.

**Unless you run it as a Cloudflare Worker, in which case that row changes and you should know it
changed.** A Worker has no keychain, so the same three secrets become encrypted bindings held by
Cloudflare. The credentials leave your machine for a third party's configuration. That is a
different posture, not a smaller one, and [Choose a runtime](#choose-a-runtime) below is where you
decide whether you want it.

The write-back workflow proves who it is with a short lived GitHub OIDC token that the bridge
verifies against GitHub's published keys. That is why there is no shared secret anywhere, and no
long lived credential sitting in repository secrets for every current and future workflow to read.

---

## Local

Node 22 and pnpm 9.

```
pnpm install
pnpm pack          # build the design pack from the token files
pnpm test:all      # the same gate the pull request runs
pnpm storybook     # the components, with a brand switcher
pnpm dev           # the page that uses them
```

`pnpm pack` writes `design-system/pack.json` and the stylesheets. They are generated and
committed on purpose, so a build never needs a live design connection and every commit builds the
same way. If you change anything under `design-system/tokens/`, run it again and commit both.

Nothing above needs a Figma file, a token, or network access beyond the package install.

---

## The Figma file

`figma/FILE.md` describes what the file has to contain: six components published as a small
library, and frames built from instances of them. It records the file key of the reference file.

The **file key** is in the URL, between `/design/` and the file name. It is not a secret.

### The personal access token

Create one at **Figma, Settings, Security, Personal access tokens**. Give it only these scopes:

| Scope | Why |
|---|---|
| `file_content:read` | read the frame, its words and its components |
| `file_dev_resources:write` | pin the issue and the pull request back onto the frame |
| `file_comments:write` | say what happened when the pull request closed |
| `webhooks:write` | register the webhook, once |

Do not grant `file_variables:write`, library write, or anything else. This token cannot create or
change a single node no matter what scopes you give it, because the REST API has no such
endpoint. The worst it can do to a designer's file is leave a link and a comment. Keeping the
scopes narrow is still worth doing: it limits which files it can read at all.

### Storing it

On macOS, the login keychain:

```
security add-generic-password -a "$USER" -s sorb-figma-api-token -w
```

It prompts for the value, twice, without echoing it.

**On another platform** you change one function. `bridge/src/bridge/config.py` has a `keychain()`
helper that shells out to macOS `security`. Point it at `secret-tool` on Linux or
`cmdkey`/DPAPI on Windows. Everything else is platform independent. It is deliberately not an
environment variable read: an environment variable is visible to every child process, and this
service spawns none, so the narrower thing costs nothing.

### Syncing the component keys

```
FIGMA_FILE_KEY=<key> pnpm sync:figma
pnpm pack
```

The first reads the file and writes `figma/code-connect.json`, one entry per published variant.
The second carries those keys into `design-system/pack.json`. Commit both.

It reads the **file**, not the published library, so nothing has to be published for this to work.
Local components carry stable keys, and a component with variants publishes one component per
variant, each with its own key, so the map carries all of them. An instance in a frame points at
the variant's key and never at the set's.

---

## GitHub

### The repository

Public or private, both work. The agent needs a Copilot plan on the account that owns it. Check
whether the coding agent can be assigned:

```
gh api graphql -f query='query {
  repository(owner:"OWNER", name:"REPO") {
    suggestedActors(capabilities:[CAN_BE_ASSIGNED], first:20) { nodes { login } }
  }
}'
```

`copilot-swe-agent` in that list means you are set. If it is absent, `docs/DECISIONS.md` describes
the alternative and what it costs.

### The label

**This one fails quietly if you skip it.** The bridge labels every issue `design:ready`, and
`pnpm demo:status` finds issues by that label. Without it, status reports no issues whether or not
any exist, which looks like calm rather than a broken query.

```
gh label create "design:ready" -R OWNER/REPO \
  --color 1d4ed8 --description "A frame was marked ready for development in Figma"
```

### Branch protection

So the agent can open a pull request and never merge one:

```
gh api -X PUT repos/OWNER/REPO/branches/main/protection \
  --input .github/branch-protection.json
```

That requires one approving review, the three status checks, and code owner review on the paths
listed in `.github/CODEOWNERS`, which are the design system, the checks and the workflows.

### Pages

**Settings, Pages, Source: GitHub Actions.** One click, once.

There is no way to set this from a workflow, and that is deliberate on GitHub's part: a workflow
that could turn on its own publishing could publish a repository nobody meant to publish. Without
it the `pages` workflow builds both sites and fails at the deploy step.

Two sites then appear on every push to `main`: Storybook at the root and the application under
`/app/`.

### The fine grained token for the bridge

Create at **github.com/settings/personal-access-tokens**, scoped to this one repository:

| Permission | Level |
|---|---|
| Issues | Read and write |
| Pull requests | Read and write |
| Contents | Read |

Nothing else. No Administration, no Actions, no other repositories. If the bridge is ever
compromised, this token is the whole blast radius.

```
security add-generic-password -a "$USER" -s figma-bridge-github-token -w
```

---

## Choose a runtime

Figma webhooks cannot call GitHub directly. A webhook can post to an address and cannot set an
`Authorization` header, so something has to translate. That something is the only part of this
system that runs anywhere, and there are two of it.

| | `bridge/`, on a machine you control | `worker/`, on Cloudflare |
|---|---|---|
| Language | Python | TypeScript |
| Secrets held by | your operating system keychain | Cloudflare, encrypted |
| You operate | a process, a machine, an address | nothing |
| Costs | whatever the machine costs | nothing at this volume |
| A changed pack is live | on the next request | after a redeploy |
| Credentials leave your machine | no | **yes** |

They are the same service. Both are held to `contract/`, an executable spec both test suites read,
and both produce the issue body byte for byte identically, because that body is the entire contract
with the coding agent and two wordings would mean two behaviours.

**Pick the machine if the last row matters to you.** Pick the Worker if you would rather not
operate anything. Then follow one of the two sections below and skip the other.

---

## The bridge, on a machine you control

One more secret, which the bridge invents rather than receives: the webhook passcode. Figma sends
it back on every delivery and the bridge compares it.

```
openssl rand -hex 24
security add-generic-password -a "$USER" -s figma-bridge-webhook-passcode -w
```

Then:

```
cd bridge
uv sync
FIGMA_FILE_KEY=<key> GITHUB_REPO=OWNER/REPO uv run figma-bridge
```

It binds to localhost on port 8787. `curl localhost:8787/health` should return the file key and
the repository name.

| Variable | Secret | What it is |
|---|---|---|
| `FIGMA_FILE_KEY` | no | the one file this bridge serves, and the only one it will answer for |
| `GITHUB_REPO` | no | `owner/name` |
| `PORT` | no | defaults to 8787 |

Only non secret values come from the environment. Anything damaging to leak comes from the
keychain.

### A public address

Figma has to reach the bridge. While building, a tunnel:

```
brew install cloudflared
cloudflared tunnel --url http://localhost:8787
```

The address changes every time the tunnel restarts, which means re-registering the webhook. For
anything you intend to leave running, put the bridge behind a reverse proxy on a server with a
stable name.

---

## The bridge, as a Cloudflare Worker

Skip this if you followed the section above. The two are alternatives, not steps.

A Cloudflare account and a login, which is interactive and yours:

```
pnpm install
npx wrangler login
```

The two non secret values live in `worker/wrangler.toml` under `[vars]`. Set them there:

```
FIGMA_FILE_KEY = "<key>"
GITHUB_REPO    = "OWNER/REPO"
```

The three secrets are put into Cloudflare, one prompt each, values pasted rather than typed on a
command line where they would land in your shell history:

```
cd worker
npx wrangler secret put FIGMA_TOKEN
npx wrangler secret put GITHUB_TOKEN
npx wrangler secret put WEBHOOK_PASSCODE
```

Same three values as the keychain items above, same scopes. The passcode is still one you invent:
`openssl rand -hex 24`.

**This is the step that changes your security posture.** Three credentials now sit in a third
party's configuration rather than in a keychain on hardware you own, and whoever can reach your
Cloudflare account can reach them. It is a reasonable trade for having nothing to operate. It is
not a free one, and `docs/DECISIONS.md` says so rather than burying it.

Then:

```
pnpm --filter figma-bridge-worker deploy
```

You get `https://figma-bridge.<your-subdomain>.workers.dev`. `curl` its `/health` and you should
see the file key and the repository, the same answer the Python service gives.

There is no tunnel, no reverse proxy, and no address that changes when something restarts. That is
most of the point.

`worker/README.md` has the limits, what happens at the free ceiling, and the one behavioural
difference: a Worker has no filesystem, so the pack is bundled at build time and a changed pack
needs a redeploy.

---

### The webhook

Whichever runtime you chose, the webhook is registered the same way. Start it first, then:

```
pnpm demo:webhook register https://your-address/figma/webhook
pnpm demo:webhook list
pnpm demo:webhook delete all
```

Registering refuses if the address is not https, if the host looks like a placeholder, if the path
is wrong, if nothing answers there, if the bridge answering serves a different file, or if this
file already has a webhook. Only then does it read the passcode and register.

That list exists because posting to Figma's webhook endpoint **creates a webhook**. There is no
dry run and no validation on their side, so a typo becomes a live webhook Figma retries against
nothing. The first version of this guide had a `curl` command with a placeholder in it, and a
webhook was registered against the literal string `YOUR-ADDRESS` within a day.

Scope is always the file, never the team. A team webhook wakes the service for every file anyone
touches.

---

## Running it

```
pnpm demo:status    # what state the loop is in, both halves
pnpm demo:reset     # put Figma and the repository back
```

Mark a frame ready for development in Dev Mode. Within seconds an issue appears carrying the
frame, its words, the components it is made of and the acceptance list, assigned to the agent.

Reset unpins the dev resources, deletes the comments the bridge left, and closes the issue, the
pull request and its branch. It does not touch the components, the frames or anything merged.

Setting a frame's status back to none is the one step no API can do. Figma can report that a frame
is ready and cannot mark one anything, which is the right place for that line: a person decides
what a design is ready for.

---

## When something does not happen

**Nothing happens when you mark a frame ready.** Check the bridge log first. A wrong passcode logs
a refusal and writes nothing, which is correct behaviour and looks identical to being down.
`pnpm demo:webhook list` shows whether the webhook is still registered and at which address. A
quick tunnel that restarted has a new address and the old webhook now points at nothing.

**The issue opens but says every component is unmapped.** The key map is empty or stale. Run
`pnpm sync:figma` and `pnpm pack` again, and check that the component names in Figma match the
names in `design-system/pack.meta.json`.

**A check failed and you want to know which kind.** `check-contract` exits 1 when the code is
wrong and 2 when the check could not run. Continuous integration fails on both, so a check that
did not run is never reported as one that passed, but the two mean completely different things to
whoever reads the log.

**The agent opened a pull request that invents a component.** That is the system working. The
contract check refuses it, and the pull request body should say what it could not do. See
`docs/pr-contract.md`.
