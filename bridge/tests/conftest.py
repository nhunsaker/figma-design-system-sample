"""Fake networks, real routes.

Every test here drives the actual FastAPI application with the actual clients, and replaces
only the transport underneath them. Mocking the clients instead would test the mocks: the parts
most likely to be wrong are the request shapes and the branching, and those only get exercised
if the code really builds a request and really reads a response.
"""

from __future__ import annotations

import json
from pathlib import Path

import httpx
import pytest

from bridge.app import create_app
from bridge.config import Settings
from bridge.figma import FigmaClient
from bridge.github import GitHubClient
from bridge.oidc import ActionsVerifier, NotFromActions

FIXTURES = Path(__file__).parent / "fixtures"
PACK = Path(__file__).parents[2] / "design-system" / "pack.json"

FILE_KEY = "AbC123XyZ"
NODE_ID = "41:207"
PASSCODE = "a-passcode-the-bridge-chose"
REPO = "nhunsaker/figma-design-system-sample"


def fixture(name: str) -> dict:
    return json.loads((FIXTURES / name).read_text())


class Recorder:
    """Every call a fake transport saw, so a test can assert that nothing was written."""

    def __init__(self) -> None:
        self.calls: list[tuple[str, str]] = []

    def record(self, request: httpx.Request) -> None:
        self.calls.append((request.method, str(request.url)))

    def wrote(self) -> list[tuple[str, str]]:
        return [c for c in self.calls if c[0] in {"POST", "PATCH", "PUT", "DELETE"}]


@pytest.fixture
def recorder() -> Recorder:
    return Recorder()


@pytest.fixture
def figma_client(recorder: Recorder) -> FigmaClient:
    def handle(request: httpx.Request) -> httpx.Response:
        recorder.record(request)
        path = request.url.path
        if path.endswith("/nodes"):
            return httpx.Response(200, json=fixture("frame-nodes.json"))
        if path.startswith("/v1/images/"):
            return httpx.Response(
                200, json={"images": {NODE_ID: "https://figma-alpha.example/x.png"}}
            )
        if path.startswith("/v1/files/") and path.endswith("/comments"):
            return httpx.Response(200, json={"id": "comment-1"})
        if path.startswith("/v1/files/"):
            return httpx.Response(200, json=fixture("file-shallow.json"))
        if path == "/v1/dev_resources":
            return httpx.Response(200, json={"links_created": [{"id": "dr-1"}]})
        return httpx.Response(404, json={"err": path})

    return FigmaClient("figma-token", httpx.Client(transport=httpx.MockTransport(handle)))


@pytest.fixture
def github_state() -> dict:
    return {"issues": [], "next": 14, "copilot": True}


@pytest.fixture
def github_client(recorder: Recorder, github_state: dict) -> GitHubClient:
    def handle(request: httpx.Request) -> httpx.Response:
        recorder.record(request)
        path = request.url.path
        if path == "/search/issues":
            needle = request.url.params.get("q", "")
            found = [i for i in github_state["issues"] if i["marker"] in needle]
            return httpx.Response(
                200,
                json={"items": [{"number": i["number"], "html_url": i["url"]} for i in found]},
            )
        if path.endswith("/issues") and request.method == "POST":
            body = json.loads(request.content)
            number = github_state["next"]
            github_state["next"] += 1
            marker = body["body"].splitlines()[0]
            issue = {
                "number": number,
                "url": f"https://github.com/{REPO}/pull/{number}",
                "marker": marker,
                "title": body["title"],
                "body": body["body"],
                "labels": body["labels"],
            }
            github_state["issues"].append(issue)
            return httpx.Response(201, json={"number": number, "html_url": issue["url"]})
        if path.endswith("/comments") and request.method == "POST":
            return httpx.Response(201, json={"id": 1})
        if path == "/graphql":
            payload = json.loads(request.content)
            if "suggestedActors" in payload["query"]:
                actors = (
                    [{"login": "copilot-swe-agent", "__typename": "Bot", "id": "BOT_1"}]
                    if github_state["copilot"]
                    else []
                )
                return httpx.Response(
                    200,
                    json={
                        "data": {
                            "repository": {
                                "issue": {"id": "ISSUE_1"},
                                "suggestedActors": {"nodes": actors},
                            }
                        }
                    },
                )
            return httpx.Response(200, json={"data": {"replaceActorsForAssignable": {}}})
        return httpx.Response(404, json={"path": path})

    return GitHubClient("gh-token", REPO, httpx.Client(transport=httpx.MockTransport(handle)))


class StubVerifier(ActionsVerifier):
    """Accepts one fixed token. The real verifier has its own tests."""

    def __init__(self, accept: str = "good-token") -> None:
        self._accept = accept

    def verify(self, authorization: str | None) -> dict:
        if authorization == f"Bearer {self._accept}":
            return {"repository": REPO}
        raise NotFromActions("no")


@pytest.fixture
def settings() -> Settings:
    return Settings(
        figma_token="figma-token",
        figma_file_key=FILE_KEY,
        webhook_passcode=PASSCODE,
        github_token="gh-token",
        github_repo=REPO,
        pack_path=str(PACK),
    )


@pytest.fixture
def client(settings, figma_client, github_client):
    from fastapi.testclient import TestClient

    app = create_app(
        settings=settings, figma=figma_client, github=github_client, verifier=StubVerifier()
    )
    return TestClient(app)
