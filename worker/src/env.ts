/**
 * What the Worker is given, and where it comes from.
 *
 * The Python bridge reads its secrets from the operating system keychain on a machine you
 * control. A Worker has no keychain: secrets are encrypted bindings held by Cloudflare. That is
 * a real difference in posture, not a detail of packaging, and docs/DECISIONS.md says so rather
 * than leaving somebody to notice it later.
 *
 * Non secret values stay in wrangler.toml under [vars]. Anything damaging to leak is a secret
 * binding, set with `wrangler secret put`, and never appears in the repository.
 */
export interface Env {
  /** The one Figma file this Worker serves. Not a secret. */
  FIGMA_FILE_KEY: string
  /** owner/name. Not a secret. */
  GITHUB_REPO: string
  /** Secret. Read the file, pin dev resources, leave comments. Cannot change a node. */
  FIGMA_TOKEN: string
  /** Secret. Fine grained, scoped to the one repository. */
  GITHUB_TOKEN: string
  /** Secret. Chosen by us and handed to Figma when the webhook was registered. */
  WEBHOOK_PASSCODE: string
}

/** Fail at the door rather than halfway through a request with half the work done. */
export function requireEnv(env: Partial<Env>): Env {
  const missing = (
    ['FIGMA_FILE_KEY', 'GITHUB_REPO', 'FIGMA_TOKEN', 'GITHUB_TOKEN', 'WEBHOOK_PASSCODE'] as const
  ).filter((key) => !env[key])
  if (missing.length > 0) {
    throw new Error(
      `missing binding(s): ${missing.join(', ')}. Vars go in wrangler.toml, secrets are set with ` +
        '`wrangler secret put NAME`.',
    )
  }
  return env as Env
}

/**
 * Compare two secrets without leaking how much of the prefix matched.
 *
 * Workers has no hmac.compare_digest, so this is the equivalent: always walk the whole string,
 * and fold the comparison into an accumulator rather than returning early.
 */
export function constantTimeEqual(a: string, b: string): boolean {
  const left = new TextEncoder().encode(a)
  const right = new TextEncoder().encode(b)
  let diff = left.length ^ right.length
  const length = Math.max(left.length, right.length)
  for (let i = 0; i < length; i++) {
    diff |= (left[i] ?? 0) ^ (right[i] ?? 0)
  }
  return diff === 0
}
