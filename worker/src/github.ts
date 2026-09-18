/**
 * The GitHub side: open an issue, label it, hand it to the agent.
 *
 * A port of bridge/src/bridge/github.py. Deliberately narrow: this token can open an issue and
 * assign it. It cannot merge anything, and it is not the token the agent runs with.
 */
const API = 'https://api.github.com'
const GRAPHQL = 'https://api.github.com/graphql'

export interface Issue {
  number: number
  url: string
}

export class GitHubClient {
  constructor(
    private readonly token: string,
    private readonly repo: string,
    private readonly fetcher: typeof fetch = fetch,
  ) {}

  private headers(): Record<string, string> {
    return {
      Authorization: `Bearer ${this.token}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      'Content-Type': 'application/json',
      // GitHub refuses an API request with no user agent.
      'User-Agent': 'figma-bridge-worker',
    }
  }

  private async request(method: string, path: string, payload?: unknown): Promise<any> {
    const response = await this.fetcher(API + path, {
      method,
      headers: this.headers(),
      body: payload === undefined ? undefined : JSON.stringify(payload),
    })
    if (!response.ok) throw new Error(`GitHub ${method} ${path} -> ${response.status}`)
    const text = await response.text()
    return text ? JSON.parse(text) : {}
  }

  async createIssue(title: string, body: string, labels: string[]): Promise<Issue> {
    const data = await this.request('POST', `/repos/${this.repo}/issues`, { title, body, labels })
    return { number: data.number, url: data.html_url }
  }

  /**
   * Find an open issue whose body carries a marker.
   *
   * Figma redelivers a webhook when it does not get a prompt success, so the same frame can
   * arrive twice. The marker is how a redelivery finds the issue the first delivery made. It
   * lives in the issue body rather than in a database because a database is a thing to run, back
   * up and lose, and this fact already sits somewhere durable that everyone can see.
   */
  async findIssueByMarker(marker: string): Promise<Issue | null> {
    const query = `repo:${this.repo} is:issue is:open in:body "${marker}"`
    const data = await this.request('GET', `/search/issues?q=${encodeURIComponent(query)}`)
    const item = (data.items ?? [])[0]
    return item ? { number: item.number, url: item.html_url } : null
  }

  async comment(issue: number, text: string): Promise<void> {
    await this.request('POST', `/repos/${this.repo}/issues/${issue}/comments`, { body: text })
  }

  /**
   * Hand the issue to the Copilot coding agent.
   *
   * Returns false rather than throwing when the agent is not available on this account. The
   * issue is already open and correct by then, and a person can pick it up: failing the whole
   * delivery because the robot is out would throw away the work just done.
   */
  async assignCopilot(issueNumber: number): Promise<boolean> {
    const [owner, name] = this.repo.split('/')
    const lookup = await this.graphql(
      `query($owner: String!, $name: String!, $number: Int!) {
         repository(owner: $owner, name: $name) {
           issue(number: $number) { id }
           suggestedActors(capabilities: [CAN_BE_ASSIGNED], first: 20) {
             nodes { login __typename ... on Bot { id } ... on User { id } }
           }
         }
       }`,
      { owner, name, number: issueNumber },
    )
    const repository = lookup?.data?.repository ?? {}
    const issueId = repository.issue?.id
    const actors = repository.suggestedActors?.nodes ?? []
    const bot = actors.find(
      (a: { login?: string }) => a.login === 'copilot-swe-agent' || a.login === 'Copilot',
    )
    if (!issueId || !bot?.id) return false

    const result = await this.graphql(
      `mutation($assignable: ID!, $actor: ID!) {
         replaceActorsForAssignable(input: {assignableId: $assignable, actorIds: [$actor]}) {
           assignable { ... on Issue { number } }
         }
       }`,
      { assignable: issueId, actor: bot.id },
    )
    return !('errors' in result)
  }

  private async graphql(query: string, variables: Record<string, unknown>): Promise<any> {
    const response = await this.fetcher(GRAPHQL, {
      method: 'POST',
      headers: this.headers(),
      body: JSON.stringify({ query, variables }),
    })
    if (!response.ok) throw new Error(`GitHub GraphQL -> ${response.status}`)
    return response.json()
  }
}
