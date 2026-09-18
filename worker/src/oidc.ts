/**
 * Verify that a request really came from this repository's Actions run.
 *
 * A port of bridge/src/bridge/oidc.py. The write back workflow holds no Figma credential and no
 * shared secret. It asks GitHub for a short lived token saying which repository, workflow and
 * event produced it, and this checks that token against GitHub's published keys.
 *
 * What that buys: this Worker can be a public address. Anything unsigned is refused, a token from
 * somebody else's repository is refused, and there is no long lived credential in a repository
 * secret for every current and future workflow to read.
 */
import { createRemoteJWKSet, jwtVerify } from 'jose'

export const ISSUER = 'https://token.actions.githubusercontent.com'
export const AUDIENCE = 'figma-bridge'

export class NotFromActions extends Error {}

export interface Verifier {
  verify(authorization: string | null): Promise<Record<string, unknown>>
}

export class ActionsVerifier implements Verifier {
  private readonly jwks: ReturnType<typeof createRemoteJWKSet>

  constructor(private readonly repo: string) {
    // createRemoteJWKSet caches the key set per isolate, so a warm Worker does not refetch it on
    // every request and a cold one pays a single round trip.
    this.jwks = createRemoteJWKSet(new URL(`${ISSUER}/.well-known/jwks`))
  }

  async verify(authorization: string | null): Promise<Record<string, unknown>> {
    if (!authorization?.toLowerCase().startsWith('bearer ')) {
      throw new NotFromActions('no bearer token')
    }
    const token = authorization.slice(7).trim()

    let claims: Record<string, unknown>
    try {
      const result = await jwtVerify(token, this.jwks, {
        issuer: ISSUER,
        audience: AUDIENCE,
        algorithms: ['RS256'],
        requiredClaims: ['exp', 'iat', 'iss', 'aud', 'sub'],
      })
      claims = result.payload as Record<string, unknown>
    } catch (error) {
      throw new NotFromActions(`token did not verify: ${(error as Error).message}`)
    }

    if (claims.repository !== this.repo) {
      // Not worth explaining to the caller: it would confirm what this guards to whoever is
      // probing it.
      throw new NotFromActions('token is for another repository')
    }
    if (typeof claims.iat === 'number' && claims.iat > Date.now() / 1000 + 60) {
      throw new NotFromActions('token was issued in the future')
    }
    return claims
  }
}
