"""Verify that a request really came from this repository's Actions run.

The write back workflow holds no Figma credential and no shared secret. It asks GitHub for a
short lived token that says which repository, workflow and event produced it, and this module
checks that token against GitHub's published keys.

What that buys: the bridge can be a public address. Anything unsigned is refused, a token from
somebody else's repository is refused, and there is no long lived credential sitting in a
repository secret for every current and future workflow to read.
"""

from __future__ import annotations

import time

import httpx
import jwt
from jwt import PyJWKClient

ISSUER = "https://token.actions.githubusercontent.com"
AUDIENCE = "figma-bridge"


class NotFromActions(Exception):
    """The token is missing, malformed, expired, or from somewhere else."""


class ActionsVerifier:
    def __init__(self, repo: str, jwks_client: PyJWKClient | None = None) -> None:
        self._repo = repo
        self._jwks = jwks_client or PyJWKClient(f"{ISSUER}/.well-known/jwks", lifespan=3600)

    def verify(self, authorization: str | None) -> dict:
        if not authorization or not authorization.lower().startswith("bearer "):
            raise NotFromActions("no bearer token")
        token = authorization.split(" ", 1)[1].strip()
        try:
            key = self._jwks.get_signing_key_from_jwt(token).key
            claims = jwt.decode(
                token,
                key,
                algorithms=["RS256"],
                audience=AUDIENCE,
                issuer=ISSUER,
                options={"require": ["exp", "iat", "iss", "aud", "sub"]},
            )
        except (jwt.PyJWTError, httpx.HTTPError) as error:
            raise NotFromActions(f"token did not verify: {error}") from error

        if claims.get("repository") != self._repo:
            # Not an error worth explaining to the caller: it would confirm what the bridge
            # guards to whoever is probing it.
            raise NotFromActions("token is for another repository")
        if claims.get("iat", 0) > time.time() + 60:
            raise NotFromActions("token was issued in the future")
        return claims
