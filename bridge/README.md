# The bridge

One small service. It listens for a frame being marked ready for development, reads that frame,
and opens a GitHub issue an agent can act on. When the pull request opens or closes it pins the
result back onto the frame.

It is about four hundred lines, and that is the point. Figma built the event, the read and the
link back. GitHub built the agent, the sandbox and the review. This is the glue between them,
and glue that grows into a platform is glue that should have been bought.

## What holds a credential, and what does not

| | Holds a Figma token | Holds a GitHub token |
|---|---|---|
| This bridge | yes, read from the Keychain | yes, scoped to one repository |
| The agent, running on GitHub | no | its own, issued by GitHub |
| Any workflow in this repository | no | its own, issued by GitHub |

The write back workflow authenticates with a short lived GitHub OIDC token that this service
verifies against GitHub's published keys. There is no shared secret and no repository secret, so
there is no long lived credential for a future workflow, or a future contributor, to read.

The Figma token can read the file, write dev resources and write comments. It cannot create or
change a single node, because the REST API cannot. The worst it can do to a designer's file is
leave a link and a comment.

## Running it

Three secrets live in the macOS login Keychain and nowhere else. Add the two the bridge creates
for itself:

```
security add-generic-password -a "$USER" -s figma-bridge-webhook-passcode -w
security add-generic-password -a "$USER" -s figma-bridge-github-token -w
```

`sorb-figma-api-token` already exists. Then:

```
cd bridge
uv sync
FIGMA_FILE_KEY=<the sample file key> uv run figma-bridge
```

It binds to localhost. Put it on the internet with a tunnel while developing:

```
cloudflared tunnel --url http://localhost:8787
```

Or behind a reverse proxy on a server for anything you intend to leave running. The tunnel URL
changes every session, which means re-pointing the webhook, which is the main reason a server is
worth the twenty minutes once the thing works.

## Registering the webhook

One call, with a passcode you generate and keep. Scope it to the one file, never to the team:

```
curl -X POST https://api.figma.com/v2/webhooks \
  -H "X-Figma-Token: $(security find-generic-password -a "$USER" -s sorb-figma-api-token -w)" \
  -H 'Content-Type: application/json' \
  -d '{"event_type":"DEV_MODE_STATUS_UPDATE","context":"file","context_id":"<file key>",
       "endpoint":"https://<your tunnel>/figma/webhook","passcode":"<the passcode>"}'
```

Figma sends a PING immediately. A 200 means it is live. `GET /v2/webhooks?context=file&context_id=<key>`
lists what is registered, and deleting one is a DELETE on its id.

## The payload

The exact shape of a `DEV_MODE_STATUS_UPDATE` delivery is recorded in `tests/fixtures/` from the
documentation, and the first real delivery is the thing that confirms it. The code reads both
`status` and `dev_status`, and anything it does not recognise produces a 204 and no write, so an
unexpected shape is a quiet no rather than a wrong yes.

## Tests

```
uv run pytest
```

Twenty five tests, most of which assert that nothing happened: a wrong passcode, a frame moved
to any other status, an event for a different file, a redelivery, an unsigned write back. A
webhook that opens an issue when it should not is worse than one that is down, because the first
failure is quiet and lands in somebody else's repository.
