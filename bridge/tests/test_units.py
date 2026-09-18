"""The small pieces, tested where they are easiest to get wrong."""

from __future__ import annotations

import pytest

from bridge.app import node_id_from
from bridge.issue import marker_for


@pytest.mark.parametrize(
    "text",
    [
        "https://www.figma.com/design/AbC123/Sample?node-id=41-207",
        "[frame](https://figma.com/design/AbC123/Sample?node-id=41-207)",
        "see https://www.figma.com/design/AbC123/Sample?m=auto&node-id=41-207&t=x",
    ],
)
def test_a_frame_link_gives_up_its_node_id_in_api_form(text):
    assert node_id_from(text) == "41:207"


@pytest.mark.parametrize(
    "text",
    [
        "no link here",
        "https://www.figma.com/design/AbC123/Sample",
        "https://example.com?node-id=1-2",
    ],
)
def test_anything_that_is_not_a_frame_link_gives_nothing(text):
    assert node_id_from(text) is None


def test_the_marker_is_stable_for_a_frame_and_different_between_frames():
    assert marker_for("file", "41:207") == marker_for("file", "41:207")
    assert marker_for("file", "41:207") != marker_for("file", "41:208")
    assert marker_for("file", "41:207") != marker_for("other", "41:207")
