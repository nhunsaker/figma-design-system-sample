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

ROOT = Path(__file__).parents[2]
CONTRACT = ROOT / "contract"
FIXTURES = CONTRACT / "fixtures"
PACK = ROOT / "design-system" / "pack.json"

# The world the cases are written against lives in the contract, not here, so the Python suite
# and the Worker suite cannot quietly disagree about what file key they are testing.
CASES = json.loads((CONTRACT / "cases.json").read_text())
FILE_KEY = CASES["world"]["file_key"]
NODE_ID = CASES["world"]["node_id"]
PASSCODE = CASES["world"]["passcode"]
REPO = CASES["world"]["repo"]


def fixture(name: str) -> dict:
    return json.loads((FIXTURES / name).read_text())


def write_kind(method: str, url: str) -> str | None:
    """Name an outbound call the way contract/cases.json names it, or None if it changes nothing.

    The expectation in the contract is a set of these names rather than a list of URLs, so the
    two implementations can spell a request however their client spells it and still be held to
    the same behaviour.
    """
    if method not in {"POST", "PATCH", "PUT", "DELETE"}:
        return None
    path = url.split("?", 1)[0]
    if path.endswith("/graphql"):
        return "github.graphql"
    if "/dev_resources" in path:
        return "figma.devresource"
    if "api.figma.com" in path and path.endswith("/comments"):
        return "figma.comment"
    if path.endswith("/comments"):
        return "github.issue.comment"
    if path.endswith("/issues"):
        return "github.issue.create"
    return None


class Recorder:
    """Every call a fake transport saw, so a test can assert that nothing was written."""

    def __init__(self) -> None:
        self.calls: list[tuple[str, str]] = []

    def record(self, request: httpx.Request) -> None:
        self.calls.append((request.method, str(request.url)))

    def wrote(self) -> list[tuple[str, str]]:
        return [c for c in self.calls if c[0] in {"POST", "PATCH", "PUT", "DELETE"}]

    def kinds(self) -> list[str]:
        """The writes that happened, named as the contract names them, sorted and deduplicated."""
        return sorted({k for m, u in self.calls if (k := write_kind(m, u))})


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
def mapped_pack(tmp_path) -> str:
    """A pack whose Button carries the key the fixture frame instantiates."""
    pack = json.loads(PACK.read_text())
    for component in pack["components"]:
        if component["name"] == "Button":
            component["figma_keys"] = ["abc123buttonkey"]
    path = tmp_path / "pack.json"
    path.write_text(json.dumps(pack))
    return str(path)


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
