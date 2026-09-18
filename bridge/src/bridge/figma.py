"""The Figma side of the bridge: read a frame, and pin things back onto it.

Three facts shape this module, and they are worth stating because they are the reason the
system is arranged the way it is.

The REST API can read any node and can write dev resources and comments. It cannot create or
change a single node, so nothing here can damage a designer's file. The worst this credential
can do is leave a link and a comment.

The REST API also cannot set a frame's dev status. Marking a frame *completed* stays a person's
click, which is the correct place for it: the system reports what happened and a person decides
what that means.

A frame names components by their Figma component key. The pack names the same components by
their code import. Code Connect is what joins the two, and until a component is mapped this
module can say a frame uses "some component" and not which one.
"""

from __future__ import annotations

from dataclasses import dataclass, field

import httpx

API = "https://api.figma.com"


@dataclass(frozen=True)
class FrameRead:
    """What the bridge learned about a frame, and what it could not learn."""

    node_id: str
    name: str
    page_name: str
    file_key: str
    file_name: str
    components: list[str] = field(default_factory=list)
    unknown_components: list[str] = field(default_factory=list)
    text: list[str] = field(default_factory=list)
    image_url: str | None = None

    @property
    def url(self) -> str:
        """The link a person opens. Figma writes 41-207 in a URL and 41:207 in the API."""
        node = self.node_id.replace(":", "-")
        return f"https://www.figma.com/design/{self.file_key}/?node-id={node}"


class FigmaClient:
    """A narrow client. Every method here is one call the bridge actually makes."""

    def __init__(self, token: str, client: httpx.Client | None = None) -> None:
        self._client = client or httpx.Client(timeout=20.0)
        self._headers = {"X-Figma-Token": token}

    def _get(self, path: str, **params: str) -> dict:
        response = self._client.get(f"{API}{path}", headers=self._headers, params=params or None)
        response.raise_for_status()
        return response.json()

    def _post(self, path: str, payload: dict) -> dict:
        response = self._client.post(f"{API}{path}", headers=self._headers, json=payload)
        response.raise_for_status()
        return response.json()

    # ── reading ────────────────────────────────────────────────────────────

    def read_frame(self, file_key: str, node_id: str, pack_components: dict[str, str]) -> FrameRead:
        """Read one frame and resolve what it is made of against the pack.

        `pack_components` maps a Figma component key to a pack component name, which is what
        Code Connect gives us. A component in the frame that is not in that map goes into
        `unknown_components` rather than being guessed at: an agent told the wrong component
        name confidently is worse than an agent told the truth vaguely.
        """
        data = self._get(f"/v1/files/{file_key}/nodes", ids=node_id, depth="8")
        entry = (data.get("nodes") or {}).get(node_id)
        if not entry:
            raise LookupError(f"node {node_id} is not in file {file_key}")

        document = entry["document"]
        components_meta = entry.get("components") or {}
        known: list[str] = []
        unknown: list[str] = []
        text: list[str] = []

        def visit(node: dict) -> None:
            if node.get("type") == "INSTANCE":
                component_id = node.get("componentId", "")
                key = (components_meta.get(component_id) or {}).get("key", "")
                name = pack_components.get(key)
                if name:
                    known.append(name)
                else:
                    unknown.append(
                        (components_meta.get(component_id) or {}).get("name")
                        or node.get("name", "unnamed")
                    )
            if node.get("type") == "TEXT" and node.get("characters"):
                text.append(node["characters"])
            for child in node.get("children") or ():
                visit(child)

        visit(document)

        return FrameRead(
            node_id=node_id,
            name=document.get("name", "unnamed frame"),
            page_name=self._page_of(file_key, node_id),
            file_key=file_key,
            file_name=data.get("name", ""),
            components=sorted(set(known)),
            unknown_components=sorted(set(unknown)),
            text=text,
        )

    def _page_of(self, file_key: str, node_id: str) -> str:
        """The page a node sits on. Cheap: one shallow read of the file's top level."""
        try:
            tree = self._get(f"/v1/files/{file_key}", depth="2")
        except httpx.HTTPError:
            return ""
        for page in (tree.get("document") or {}).get("children") or ():
            for child in page.get("children") or ():
                if child.get("id") == node_id:
                    return page.get("name", "")
        return ""

    def image(self, file_key: str, node_id: str, scale: int = 2) -> str | None:
        """A rendered PNG of the frame, as a temporary URL Figma hosts.

        The URL expires. The issue carries it anyway, because a reviewer reads the issue within
        hours and the alternative is this service storing and serving images, which is a
        different and much larger thing to run.
        """
        data = self._get(f"/v1/images/{file_key}", ids=node_id, format="png", scale=str(scale))
        return (data.get("images") or {}).get(node_id)

    # ── writing, which is only ever a link or a comment ────────────────────

    def pin_dev_resource(self, file_key: str, node_id: str, name: str, url: str) -> dict:
        """Pin a link to a frame, where it shows in Dev Mode next to the design."""
        return self._post(
            "/v1/dev_resources",
            {
                "dev_resources": [
                    {"name": name, "url": url, "file_key": file_key, "node_id": node_id}
                ]
            },
        )

    def comment(self, file_key: str, node_id: str, message: str) -> dict:
        """Leave a comment attached to a frame."""
        return self._post(
            f"/v1/files/{file_key}/comments",
            {
                "message": message,
                "comment_pin_corner": "top-left",
                "client_meta": {"node_id": node_id, "node_offset": {"x": 0, "y": 0}},
            },
        )
