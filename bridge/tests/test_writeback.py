"""The back door, which only our own Actions run may knock on."""

from __future__ import annotations

FRAME = "https://www.figma.com/design/AbC123XyZ/Sample?node-id=41-207"
AUTH = {"Authorization": "Bearer good-token"}


def body(**overrides) -> dict:
    payload = {
        "event": "opened",
        "merged": False,
        "number": 14,
        "title": "Build Empty state",
        "url": "https://github.com/nhunsaker/figma-design-system-sample/pull/14",
        "body": f"## Frame\n\n[Empty state]({FRAME})\n",
    }
    payload.update(overrides)
    return payload


def test_an_opened_pull_request_is_pinned_to_the_frame(client, recorder):
    response = client.post("/github/pull-request", json=body(), headers=AUTH)
    assert response.json() == {"wrote": True, "what": "dev resource"}
    assert any(url.endswith("/v1/dev_resources") for _, url in recorder.wrote())


def test_a_merge_leaves_a_comment_saying_nothing_has_shipped(client, recorder):
    response = client.post(
        "/github/pull-request", json=body(event="closed", merged=True), headers=AUTH
    )
    assert response.json()["what"] == "comment"
    assert any("/comments" in url for _, url in recorder.wrote())


def test_a_close_without_merge_also_reports_back(client, recorder):
    response = client.post(
        "/github/pull-request", json=body(event="closed", merged=False), headers=AUTH
    )
    assert response.json()["what"] == "comment"


def test_an_unsigned_request_writes_nothing(client, recorder):
    assert client.post("/github/pull-request", json=body()).status_code == 401
    assert recorder.wrote() == []


def test_a_forged_token_writes_nothing(client, recorder):
    response = client.post(
        "/github/pull-request", json=body(), headers={"Authorization": "Bearer nope"}
    )
    assert response.status_code == 401
    assert recorder.wrote() == []


def test_a_pull_request_that_names_no_frame_is_left_alone(client, recorder):
    response = client.post("/github/pull-request", json=body(body="a tidy up"), headers=AUTH)
    assert response.json()["wrote"] is False
    assert recorder.wrote() == []
