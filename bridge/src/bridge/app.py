"""The bridge.

Two doors, and both of them are shut by default.

`POST /figma/webhook` is Figma telling us a frame changed dev status. It is authenticated by a
passcode that the bridge chose and gave to Figma when the webhook was registered.

`POST /github/pull-request` is our own Actions run telling us what happened to a pull request.
It is authenticated by a GitHub OIDC token, verified against GitHub's published keys.

Everything else is refused. There is no route that reads a file key from the caller: the bridge
serves exactly one Figma file, named in its own configuration, so a valid passcode still cannot
be used to read somebody else's design.
"""

from __future__ import annotations

import hmac
import json
import logging
import re
from pathlib import Path
from typing import Annotated

from fastapi import Body, FastAPI, Header, HTTPException, Response

from .config import Settings, load_settings
from .figma import FigmaClient
from .github import GitHubClient
from .issue import body_for, marker_for, title_for
from .oidc import ActionsVerifier, NotFromActions

log = logging.getLogger("bridge")

READY = "READY_FOR_DEV"
LABEL = "design:ready"


def code_connect_map(pack_path: str) -> tuple[dict[str, str], str]:
    """Figma component key to pack component name, plus the pack's id.

    The mapping lives in the pack, written there by Code Connect, so the bridge has no second
    copy of it to keep in step.
    """
    pack = json.loads(Path(pack_path).read_text())
    mapping = {
        component["figma_key"]: component["name"]
        for component in pack.get("components", ())
        if component.get("figma_key")
    }
    return mapping, pack.get("id", "")


def create_app(
    settings: Settings | None = None,
    figma: FigmaClient | None = None,
    github: GitHubClient | None = None,
    verifier: ActionsVerifier | None = None,
) -> FastAPI:
    """Everything is injectable so the tests exercise the real routes with fake networks."""
    settings = settings or load_settings()
    figma = figma or FigmaClient(settings.figma_token)
    github = github or GitHubClient(settings.github_token, settings.github_repo)
    verifier = verifier or ActionsVerifier(settings.github_repo)

    app = FastAPI(title="figma bridge", docs_url=None, redoc_url=None)

    @app.get("/health")
    def health() -> dict:
        return {"ok": True, "file": settings.figma_file_key, "repo": settings.github_repo}

    @app.post("/figma/webhook")
    def figma_webhook(payload: Annotated[dict, Body()]) -> Response:
        # Figma sends a PING when the webhook is registered. Answering it is what confirms the
        # endpoint is alive, and it carries the passcode like everything else.
        passcode = str(payload.get("passcode", ""))
        if not hmac.compare_digest(passcode, settings.webhook_passcode):
            log.warning("refused a webhook with a wrong passcode")
            raise HTTPException(status_code=401, detail="no")

        event = payload.get("event_type")
        if event == "PING":
            return Response(status_code=200, content='{"ok":true}', media_type="application/json")
        if event != "DEV_MODE_STATUS_UPDATE":
            return Response(status_code=204)

        # The bridge serves one file. A payload naming another one is not something to reason
        # about, it is something to stop at.
        file_key = payload.get("file_key")
        if file_key != settings.figma_file_key:
            log.warning("refused a webhook for a file this bridge does not serve")
            raise HTTPException(status_code=403, detail="no")

        status = (payload.get("status") or payload.get("dev_status") or "").upper()
        node_id = payload.get("node_id") or ""
        if status != READY or not node_id:
            return Response(status_code=204)

        marker = marker_for(file_key, node_id)
        existing = github.find_issue_by_marker(marker)
        if existing:
            # A redelivery, or a designer toggling the status twice. Answer 200 so Figma stops
            # retrying, and do not open a second issue for the same frame.
            log.info("frame already has issue %s", existing.number)
            return Response(
                status_code=200,
                content=json.dumps({"issue": existing.number, "created": False}),
                media_type="application/json",
            )

        mapping, pack_id = code_connect_map(settings.pack_path)
        frame = figma.read_frame(file_key, node_id, mapping)
        image = figma.image(file_key, node_id)
        issue = github.create_issue(
            title=title_for(frame), body=body_for(frame, image, pack_id), labels=[LABEL]
        )
        assigned = github.assign_copilot(issue.number)
        if not assigned:
            github.comment(
                issue.number,
                "The coding agent is not available on this account, so this issue is waiting "
                "for a person. Everything it needs is above.",
            )
        figma.pin_dev_resource(file_key, node_id, f"Issue {issue.number}", issue.url)
        log.info("opened issue %s for node %s", issue.number, node_id)
        return Response(
            status_code=200,
            content=json.dumps({"issue": issue.number, "created": True, "assigned": assigned}),
            media_type="application/json",
        )

    @app.post("/github/pull-request")
    def pull_request(
        payload: Annotated[dict, Body()],
        authorization: Annotated[str | None, Header()] = None,
    ) -> dict:
        try:
            verifier.verify(authorization)
        except NotFromActions as error:
            log.warning("refused a write back: %s", error)
            raise HTTPException(status_code=401, detail="no") from error

        node_id = node_id_from(payload.get("body") or "")
        if not node_id:
            # Nothing to write back to. Not an error: a pull request that names no frame is a
            # person's ordinary change, and the contract check is what holds an agent's to a
            # higher standard than that.
            return {"wrote": False, "why": "the pull request body names no frame"}

        file_key = settings.figma_file_key
        event = payload.get("event")
        number = payload.get("number")
        url = payload.get("url", "")

        if event in {"opened", "reopened"}:
            figma.pin_dev_resource(file_key, node_id, f"Pull request {number}", url)
            return {"wrote": True, "what": "dev resource"}

        if event == "closed":
            if payload.get("merged"):
                message = (
                    f"Built and merged in pull request {number}. It is behind a flag that is "
                    f"off, so nothing has changed for anyone yet. {url}"
                )
            else:
                message = (
                    f"Pull request {number} was closed without merging, so this frame has not "
                    f"been built. {url}"
                )
            figma.comment(file_key, node_id, message)
            return {"wrote": True, "what": "comment"}

        return {"wrote": False, "why": f"nothing to do for {event}"}

    return app


NODE_ID = re.compile(
    r"figma\.com/(?:design|file)/[A-Za-z0-9]+[^\s)]*?node[-_]id=([0-9]+[-:][0-9]+)"
)


def node_id_from(text: str) -> str | None:
    """Pull the frame out of a pull request body.

    Figma writes 41-207 in a link and 41:207 in the API, so this returns the API form.
    """
    match = NODE_ID.search(text)
    return match.group(1).replace("-", ":") if match else None
