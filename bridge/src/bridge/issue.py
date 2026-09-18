"""Turn a frame into the issue an agent will read.

The agent gets one shot at understanding what was asked for. Everything it needs is here, and
nothing it does not need is: no ladder vocabulary, no internal machinery, no instructions that
duplicate AGENTS.md, because the agent reads that file anyway and two copies of a rule is one
rule that will drift.

The one judgement this module makes is to be explicit about what the bridge could not work out.
A frame using a component Code Connect has not mapped produces a line saying exactly that. An
agent told the truth vaguely does better work than an agent told a guess confidently.
"""

from __future__ import annotations

from .figma import FrameRead, UnmappedComponent

MARKER = "<!-- figma-bridge:{key} -->"


def _size_of(component: UnmappedComponent) -> str:
    """` (672 by 80)` when the reader measured it, and nothing when it could not."""
    if component.width and component.height:
        return f" ({component.width} by {component.height})"
    return ""


def marker_for(file_key: str, node_id: str) -> str:
    """The idempotency key, carried in the issue body so a redelivery finds the first issue."""
    return MARKER.format(key=f"{file_key}:{node_id}")


def title_for(frame: FrameRead) -> str:
    where = f" on {frame.page_name}" if frame.page_name else ""
    return f"Build {frame.name}{where}"


def body_for(frame: FrameRead, image_url: str | None, pack_id: str) -> str:
    lines: list[str] = [
        marker_for(frame.file_key, frame.node_id),
        "",
        f"A designer marked **{frame.name}** ready for development.",
        "",
        f"[Open the frame in Figma]({frame.url})",
        "",
    ]

    if image_url:
        lines += [
            f"![{frame.name}]({image_url})",
            "",
            "_The image above is a temporary Figma export and will stop loading after a"
            " while. The link to the frame is the durable one._",
            "",
        ]

    lines += ["## What the frame is made of", ""]
    if frame.components:
        lines += [f"- `{name}` from the design pack" for name in frame.components]
    if frame.unknown_components:
        lines += [
            f"- **{component.name}** — not mapped to a pack component{_size_of(component)}"
            for component in frame.unknown_components
        ]
    if not frame.components and not frame.unknown_components:
        lines.append("- Nothing the bridge could identify. Read the frame before you build.")
    lines.append("")

    if frame.unknown_components:
        lines += [
            "> Some of this frame is not mapped to code. Do not guess which component was meant.",
            "> Use `Missing` from the pack for each one, passing the name and the size above, and",
            "> build the rest of the frame normally. Say what you used it for in the pull request",
            "> under Left undone.",
            "",
        ]

    if frame.text:
        lines += [
            "## The words in the frame",
            "",
            "Use these exactly. Copy is a design decision.",
            "",
        ]
        lines += [f"- {line}" for line in frame.text]
        lines.append("")

    lines += [
        "## Acceptance",
        "",
        "- [ ] The change matches the frame",
        "- [ ] Only components from the design pack are used",
        "- [ ] A story covers the new state",
        "- [ ] `pnpm test:all` passes",
        "- [ ] The change is behind a flag in `src/flags.ts`, set to `false`",
        "",
        "## Before you start",
        "",
        f"Read `design-system/pack.json` (`{pack_id}`) and `AGENTS.md`. The pack is the whole",
        "vocabulary and the checks enforce it, so building to the pack is faster than building",
        "around it.",
    ]
    return "\n".join(lines)
