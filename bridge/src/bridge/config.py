"""Where the bridge gets its secrets, and where it refuses to get them.

Every credential is read from the macOS login Keychain at start up, once, and held in memory.
There is no `.env` file and no default value, because a secret with a default is a secret that
works by accident on the wrong machine.

The bridge is the only process in this system that holds a Figma token. The agent runs on
GitHub and never sees one: it gets what the issue carries and nothing else. That is the trust
boundary, and it is drawn here rather than in a diagram.
"""

from __future__ import annotations

import os
import subprocess
from dataclasses import dataclass
from functools import cache


class MissingSecret(RuntimeError):
    """A credential the bridge cannot run without. Never carries the value it was looking for."""


@cache
def keychain(service: str, account: str | None = None) -> str:
    """Read one generic password from the login Keychain.

    The value is returned, never logged, and never passed as a command line argument anywhere
    else in this codebase. An argv is visible to every process on the machine.
    """
    account = account or os.environ.get("USER", "")
    argv = ["security", "find-generic-password", "-s", service, "-w"]
    if account:
        argv[2:2] = ["-a", account]
    result = subprocess.run(argv, capture_output=True, text=True, check=False)  # noqa: S603
    if result.returncode != 0 or not result.stdout.strip():
        raise MissingSecret(
            f"no Keychain item for service {service!r}. "
            f"Add it with: security add-generic-password -a $USER -s {service} -w"
        )
    return result.stdout.strip()


@dataclass(frozen=True)
class Settings:
    """Everything the bridge needs to know, resolved once at start up."""

    figma_token: str
    figma_file_key: str
    webhook_passcode: str
    github_token: str
    github_repo: str
    pack_path: str

    @property
    def github_owner(self) -> str:
        return self.github_repo.split("/", 1)[0]

    @property
    def github_name(self) -> str:
        return self.github_repo.split("/", 1)[1]


def load_settings() -> Settings:
    """Resolve settings from the Keychain and the environment.

    Only non secret values come from the environment: which file, which repository, where the
    pack is. Anything that would be damaging to leak comes from the Keychain.
    """
    file_key = os.environ.get("FIGMA_FILE_KEY")
    if not file_key:
        raise MissingSecret("set FIGMA_FILE_KEY to the sample file's key. It is not a secret.")
    repo = os.environ.get("GITHUB_REPO", "nhunsaker/figma-design-system-sample")
    here = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
    return Settings(
        figma_token=keychain("sorb-figma-api-token"),
        figma_file_key=file_key,
        webhook_passcode=keychain("figma-bridge-webhook-passcode"),
        github_token=keychain("figma-bridge-github-token"),
        github_repo=repo,
        pack_path=os.environ.get(
            "PACK_PATH", os.path.join(os.path.dirname(here), "design-system", "pack.json")
        ),
    )
