# What Figma can actually do, as of September 2026

The short version, because it is the thing that decides how much of this system you build and
how much you already have.

## Read, write, and what can start something

| Surface | Reads | Writes | Starts something | Needs |
|---|---|---|---|---|
| REST API | any node, styles, components, variables | dev resources, comments, and variables on Enterprise only | no | a personal access token with the right scopes |
| Webhooks v2 | nothing | nothing | yes, this is the trigger | `webhooks:write`, scoped to a file, project or team |
| Plugin API | everything in the open file | everything in the open file | only from inside the editor | a person with the file open |
| MCP server | design context, variables, screenshots, Code Connect | creates and edits nodes since February 2026 | no | a Full seat |
| Code Connect | the component map | the map | no | a paid seat, published per component |
| Dev Mode | status, dev resources, first party apps | a person sets the status | the status change fires a webhook | Dev Mode access |

## The three facts that shape any system built on this

**REST cannot create a node.** Not a frame, not a layer, not a text run. Anything that draws in
Figma is the plugin API, which needs the editor open, or the MCP server, which needs a Full seat
and an agent session. This is why a service like the bridge is safe to run unattended. The worst
its credential can do is leave a link and a comment.

**REST cannot set a dev status.** It can read that a frame is ready and it cannot mark one
completed. That is a person's click, which is the right place for it: the system reports what
happened and a person decides what it means.

**Webhooks v2 is the only real trigger.** The events are `DEV_MODE_STATUS_UPDATE`,
`FILE_UPDATE`, `FILE_VERSION_UPDATE`, `FILE_COMMENT`, `FILE_DELETE` and `LIBRARY_PUBLISH`. Scope
them to a file rather than a team unless you want every file in the team waking your service. A
webhook carries a passcode you choose, and Figma redelivers when it does not get a prompt
success, which is why anything downstream has to be idempotent.

## The parts that are native, and that people keep proposing to build

Ready for development as a status, dev resources pinned to a frame, and the Jira, GitHub and
Storybook apps in Dev Mode are all Figma's own. None of them need building. A plan that includes
writing a handoff tool has usually not looked at what the seat already includes.

## What this repository uses

The webhook to start, REST to read the frame and export a PNG, REST to pin the pull request
back as a dev resource and to comment when it closes, and the published library's component keys
so a frame resolves to real component names. That is all of it.

The fuller notes, with sources, are in the Stage 3 working session material under
`figma-connectivity.html`.
