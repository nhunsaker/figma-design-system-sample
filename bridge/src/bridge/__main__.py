"""Run the bridge.

    FIGMA_FILE_KEY=... uv run figma-bridge

It binds to localhost only. Reaching it from the internet is a tunnel's job or a reverse
proxy's job, and both of those are things somebody configured on purpose.
"""

from __future__ import annotations

import logging
import os

import uvicorn

from .app import create_app


def main() -> None:
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
    uvicorn.run(create_app(), host="127.0.0.1", port=int(os.environ.get("PORT", "8787")))


if __name__ == "__main__":
    main()
