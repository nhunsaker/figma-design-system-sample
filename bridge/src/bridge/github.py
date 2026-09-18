"""The GitHub side of the bridge: open an issue, label it, hand it to the agent.

Adapted from the same client shape used in the fidelity-ladder harness, kept deliberately
narrow. This token can open an issue and assign it. It cannot merge anything, and it is not the
token the agent runs with.
"""

from __future__ import annotations

from dataclasses import dataclass

import httpx

API = "https://api.github.com"
GRAPHQL = "https://api.github.com/graphql"


@dataclass(frozen=True)
class Issue:
    number: int
    url: str


class GitHubClient:
    def __init__(self, token: str, repo: str, client: httpx.Client | None = None) -> None:
        self._client = client or httpx.Client(timeout=20.0)
        self._repo = repo
        self._headers = {
            "Authorization": f"Bearer {token}",
            "Accept": "application/vnd.github+json",
            "X-GitHub-Api-Version": "2022-11-28",
        }

    def _request(self, method: str, path: str, payload: dict | None = None) -> dict:
        response = self._client.request(method, f"{API}{path}", headers=self._headers, json=payload)
        response.raise_for_status()
        return response.json() if response.content else {}

    def create_issue(self, title: str, body: str, labels: list[str]) -> Issue:
        data = self._request(
            "POST", f"/repos/{self._repo}/issues", {"title": title, "body": body, "labels": labels}
        )
        return Issue(number=data["number"], url=data["html_url"])

    def find_issue_by_marker(self, marker: str) -> Issue | None:
        """Find an open issue whose body carries a marker.

        Figma redelivers a webhook when it does not get a prompt 200, so the same frame can
        arrive twice. The marker is how a redelivery finds the issue the first delivery made,
        rather than opening a second one. Held in the issue body rather than in a database
        because a database is a thing to run, back up and lose, and this fact already lives in
        a durable place that everyone can see.
        """
        query = f'repo:{self._repo} is:issue is:open in:body "{marker}"'
        data = self._request("GET", f"/search/issues?q={httpx.QueryParams({'q': query})['q']}")
        for item in data.get("items") or ():
            return Issue(number=item["number"], url=item["html_url"])
        return None

    def comment(self, issue: int, text: str) -> None:
        self._request("POST", f"/repos/{self._repo}/issues/{issue}/comments", {"body": text})

    def assign_copilot(self, issue_number: int) -> bool:
        """Hand the issue to the Copilot coding agent.

        Returns False rather than raising when the agent is not available on this account. The
        issue is already open and correct at that point, and a person can pick it up: failing
        the whole delivery because the robot is out would lose the work the bridge just did.
        """
        lookup = self._graphql(
            """
            query($owner: String!, $name: String!, $number: Int!) {
              repository(owner: $owner, name: $name) {
                issue(number: $number) { id }
                suggestedActors(capabilities: [CAN_BE_ASSIGNED], first: 20) {
                  nodes { login __typename ... on Bot { id } ... on User { id } }
                }
              }
            }
            """,
            {
                "owner": self._repo.split("/")[0],
                "name": self._repo.split("/")[1],
                "number": issue_number,
            },
        )
        repository = (lookup.get("data") or {}).get("repository") or {}
        issue_id = (repository.get("issue") or {}).get("id")
        actors = ((repository.get("suggestedActors") or {}).get("nodes")) or []
        bot = next((a for a in actors if a.get("login") in {"copilot-swe-agent", "Copilot"}), None)
        if not issue_id or not bot or not bot.get("id"):
            return False
        result = self._graphql(
            """
            mutation($assignable: ID!, $actor: ID!) {
              replaceActorsForAssignable(input: {assignableId: $assignable, actorIds: [$actor]}) {
                assignable { ... on Issue { number } }
              }
            }
            """,
            {"assignable": issue_id, "actor": bot["id"]},
        )
        return "errors" not in result

    def _graphql(self, query: str, variables: dict) -> dict:
        response = self._client.post(
            GRAPHQL, headers=self._headers, json={"query": query, "variables": variables}
        )
        response.raise_for_status()
        return response.json()
