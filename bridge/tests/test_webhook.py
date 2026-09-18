"""The front door.

The tests that matter here are the ones where nothing should happen. A webhook endpoint that
opens an issue when it should not is worse than one that is down, because the first failure is
quiet and arrives as noise in somebody's repository.
"""

from __future__ import annotations

from .conftest import FILE_KEY, NODE_ID, PASSCODE


def ready(**overrides) -> dict:
    payload = {
        "event_type": "DEV_MODE_STATUS_UPDATE",
        "passcode": PASSCODE,
        "file_key": FILE_KEY,
        "node_id": NODE_ID,
        "status": "READY_FOR_DEV",
        "timestamp": "2026-09-18T06:00:00Z",
        "webhook_id": "wh-1",
    }
    payload.update(overrides)
    return payload


def test_a_ready_frame_opens_one_issue(client, github_state):
    response = client.post("/figma/webhook", json=ready())
    assert response.status_code == 200
    assert response.json()["created"] is True
    assert len(github_state["issues"]) == 1
    assert github_state["issues"][0]["labels"] == ["design:ready"]


def test_the_issue_carries_the_frame_and_what_it_is_made_of(client, github_state):
    client.post("/figma/webhook", json=ready())
    body = github_state["issues"][0]["body"]
    assert "node-id=41-207" in body
    assert "Empty state" in body
    assert "No frames are ready yet." in body
    assert "`Button` from the design pack" not in body  # nothing is mapped yet


def test_an_unmapped_component_is_named_as_unmapped_rather_than_guessed(client, github_state):
    client.post("/figma/webhook", json=ready())
    body = github_state["issues"][0]["body"]
    assert "not mapped to a pack component" in body
    assert "Do not guess which component was meant" in body


def test_a_wrong_passcode_writes_nothing(client, recorder, github_state):
    response = client.post("/figma/webhook", json=ready(passcode="guessed"))
    assert response.status_code == 401
    assert github_state["issues"] == []
    assert recorder.wrote() == []


def test_a_missing_passcode_writes_nothing(client, recorder):
    payload = ready()
    del payload["passcode"]
    assert client.post("/figma/webhook", json=payload).status_code == 401
    assert recorder.wrote() == []


def test_a_frame_moved_to_any_other_status_writes_nothing(client, recorder, github_state):
    response = client.post("/figma/webhook", json=ready(status="COMPLETED"))
    assert response.status_code == 204
    assert github_state["issues"] == []
    assert recorder.wrote() == []


def test_another_event_type_writes_nothing(client, recorder):
    assert client.post("/figma/webhook", json=ready(event_type="FILE_UPDATE")).status_code == 204
    assert recorder.wrote() == []


def test_a_ping_is_answered_so_registration_can_succeed(client, recorder):
    response = client.post("/figma/webhook", json=ready(event_type="PING"))
    assert response.status_code == 200
    assert recorder.wrote() == []


def test_a_payload_for_another_file_is_refused(client, recorder, github_state):
    response = client.post("/figma/webhook", json=ready(file_key="SomeoneElsesFile"))
    assert response.status_code == 403
    assert github_state["issues"] == []
    assert recorder.wrote() == []


def test_a_redelivery_finds_the_first_issue_instead_of_opening_a_second(client, github_state):
    first = client.post("/figma/webhook", json=ready()).json()
    second = client.post("/figma/webhook", json=ready(timestamp="2026-09-18T06:00:05Z")).json()
    assert second["created"] is False
    assert second["issue"] == first["issue"]
    assert len(github_state["issues"]) == 1


def test_the_issue_is_pinned_back_onto_the_frame(client, recorder):
    client.post("/figma/webhook", json=ready())
    assert any(url.endswith("/v1/dev_resources") for _, url in recorder.wrote())


def test_the_issue_still_opens_when_the_coding_agent_is_unavailable(client, github_state):
    github_state["copilot"] = False
    response = client.post("/figma/webhook", json=ready())
    assert response.status_code == 200
    assert response.json()["assigned"] is False
    assert len(github_state["issues"]) == 1
