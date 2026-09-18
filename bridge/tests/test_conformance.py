"""Hold this implementation to contract/, which the Cloudflare Worker is also held to.

Two implementations of one behaviour drift. That is the failure this whole repository is arranged
against, so having a second runtime without a shared spec would be incoherent.

Two checks do the work:

* every case in contract/cases.json, asserting the status AND what was written, because most of
  the cases are ones where nothing should happen and a webhook that acts when it should not is
  worse than one that is down;
* the issue body, byte for byte, against contract/golden/. The body is the entire contract with
  the agent, so a word changed in one runtime and not the other means the agent behaves
  differently depending on where the webhook landed.

Regenerate the golden, when the wording genuinely should change:

    cd bridge && UPDATE_GOLDEN=1 uv run pytest -k golden

Then read the diff. If it is larger than you meant, that is what the file is for. Make the same
change in the Worker, or the two runtimes hand the agent different instructions.
"""

from __future__ import annotations

import json
import os
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from bridge.app import code_connect_map, create_app
from bridge.issue import body_for, title_for

from .conftest import CASES, CONTRACT, StubVerifier

GOLDEN = CONTRACT / "golden"


def client_for(settings, figma_client, github_client):
    return TestClient(
        create_app(
            settings=settings, figma=figma_client, github=github_client, verifier=StubVerifier()
        )
    )


# ─── the behaviour table ────────────────────────────────────────────────────


@pytest.mark.parametrize("case", CASES["webhook"], ids=lambda c: c["name"])
def test_webhook_case(case, settings, figma_client, github_client, recorder, github_state):
    client = client_for(settings, figma_client, github_client)

    # A redelivery only means anything after the first delivery, so replay that one first and
    # then forget what it wrote.
    if case.get("repeat_of"):
        first = next(c for c in CASES["webhook"] if c["name"] == case["repeat_of"])
        client.post("/figma/webhook", json=first["payload"])
        recorder.calls.clear()

    response = client.post("/figma/webhook", json=case["payload"])
    expect = case["expect"]

    assert response.status_code == expect["status"], case["name"]
    assert recorder.kinds() == expect["writes"], case["name"]
    assert len(github_state["issues"]) == expect["issues_after"], case["name"]
    if "created" in expect:
        assert response.json()["created"] is expect["created"], case["name"]


@pytest.mark.parametrize("case", CASES["writeback"], ids=lambda c: c["name"])
def test_writeback_case(case, settings, figma_client, github_client, recorder):
    client = client_for(settings, figma_client, github_client)
    headers = {"Authorization": "Bearer good-token"} if case["signed"] else {}

    response = client.post("/github/pull-request", json=case["payload"], headers=headers)
    expect = case["expect"]

    assert response.status_code == expect["status"], case["name"]
    assert recorder.kinds() == expect["writes"], case["name"]
    if expect.get("wrote"):
        assert response.json()["what"] == expect["wrote"], case["name"]
    elif expect["status"] == 200:
        assert response.json()["wrote"] is False, case["name"]


# ─── the words the agent reads ──────────────────────────────────────────────


def build_issue(settings, figma_client, *, mapped: bool) -> tuple[str, str]:
    """The title and body this implementation produces for the fixture frame."""
    pack_path = settings.pack_path
    if mapped:
        pack = json.loads(Path(pack_path).read_text())
        for component in pack["components"]:
            if component["name"] == "Button":
                component["figma_keys"] = ["abc123buttonkey"]
        tmp = GOLDEN / ".pack.tmp.json"
        tmp.write_text(json.dumps(pack))
        pack_path = str(tmp)

    mapping, pack_id = code_connect_map(pack_path)
    if mapped:
        (GOLDEN / ".pack.tmp.json").unlink(missing_ok=True)

    frame = figma_client.read_frame(CASES["world"]["file_key"], CASES["world"]["node_id"], mapping)
    return title_for(frame), body_for(frame, None, pack_id)


@pytest.mark.parametrize(
    ("name", "mapped"),
    [("issue-unmapped.md", False), ("issue-mapped.md", True)],
)
def test_issue_body_matches_the_golden(name, mapped, settings, figma_client):
    title, body = build_issue(settings, figma_client, mapped=mapped)
    produced = f"# {title}\n\n{body}"

    if os.environ.get("UPDATE_GOLDEN"):
        GOLDEN.mkdir(parents=True, exist_ok=True)
        (GOLDEN / name).write_text(produced)
        pytest.skip(f"rewrote contract/golden/{name}")

    golden = (GOLDEN / name).read_text()
    assert produced == golden, (
        f"{name} differs. If the change is intended, regenerate the golden and make the same "
        f"change in the Worker, or the agent gets different instructions depending on which "
        f"runtime the webhook reached."
    )


def test_a_frame_the_pack_cannot_build_warns_rather_than_guesses(settings, figma_client):
    """The fixture frame instances a component the pack does not list. That has to survive."""
    _, body = build_issue(settings, figma_client, mapped=False)
    assert "not mapped to a pack component" in body
    assert "Do not guess which component was meant" in body

