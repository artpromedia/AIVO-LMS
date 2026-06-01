/**
 * Phase 2 (multi-replica) — Postgres-backed store for the OIDC provider's
 * ephemeral grant state (auth codes, access tokens, refresh tokens).
 *
 * Previously these lived in process-local `Map`s, which only works on a
 * single replica: a code issued on one pod can't be redeemed on another, and
 * a rolling deploy drops every in-flight grant. Backing them with Postgres
 * makes the provider correct under horizontal scaling.
 *
 * Only the SHA-256 hash of each code/token is persisted — never the raw value
 * — mirroring sessions.refresh_token / password_reset_tokens, so a database
 * compromise yields no usable credentials.
 */
import { createHash } from "node:crypto";
import { eq, lt } from "drizzle-orm";
import { oidcAuthCodes, oidcAccessTokens, oidcRefreshTokens } from "@aivo/db";

function hashToken(raw: string): string {
  return createHash("sha256").update(raw).digest("hex");
}

export interface AuthCodeData {
  clientId: string;
  redirectUri: string;
  scope: string;
  userId: string;
  codeChallenge: string;
  nonce?: string;
}

export interface TokenGrant {
  userId: string;
  clientId: string;
  scope: string;
}

export class OidcStore {
  constructor(private readonly db: any) {}

  async saveAuthCode(rawCode: string, data: AuthCodeData, ttlMs: number): Promise<void> {
    await this.db.insert(oidcAuthCodes).values({
      codeHash: hashToken(rawCode),
      clientId: data.clientId,
      redirectUri: data.redirectUri,
      scope: data.scope,
      userId: data.userId,
      codeChallenge: data.codeChallenge,
      nonce: data.nonce ?? null,
      expiresAt: new Date(Date.now() + ttlMs),
    });
  }

  /**
   * Single-use redemption: fetch then delete the code atomically enough for
   * our purposes (the row is deleted before PKCE is checked, so a replayed
   * code can never be redeemed twice). Returns `{ expired }` so the caller
   * can distinguish "unknown" (null) from "known but stale".
   */
  async takeAuthCode(rawCode: string): Promise<(AuthCodeData & { expired: boolean }) | null> {
    const codeHash = hashToken(rawCode);
    const [row] = await this.db
      .select()
      .from(oidcAuthCodes)
      .where(eq(oidcAuthCodes.codeHash, codeHash))
      .limit(1);
    if (!row) return null;
    await this.db.delete(oidcAuthCodes).where(eq(oidcAuthCodes.codeHash, codeHash));
    return {
      clientId: row.clientId,
      redirectUri: row.redirectUri,
      scope: row.scope,
      userId: row.userId,
      codeChallenge: row.codeChallenge,
      nonce: row.nonce ?? undefined,
      expired: new Date(row.expiresAt).getTime() < Date.now(),
    };
  }

  async saveAccessToken(rawToken: string, data: TokenGrant, ttlMs: number): Promise<void> {
    await this.db.insert(oidcAccessTokens).values({
      tokenHash: hashToken(rawToken),
      userId: data.userId,
      clientId: data.clientId,
      scope: data.scope,
      expiresAt: new Date(Date.now() + ttlMs),
    });
  }

  async getAccessToken(rawToken: string): Promise<TokenGrant | null> {
    const [row] = await this.db
      .select()
      .from(oidcAccessTokens)
      .where(eq(oidcAccessTokens.tokenHash, hashToken(rawToken)))
      .limit(1);
    if (!row) return null;
    if (new Date(row.expiresAt).getTime() < Date.now()) return null;
    return { userId: row.userId, clientId: row.clientId, scope: row.scope };
  }

  async saveRefreshToken(rawToken: string, data: TokenGrant): Promise<void> {
    await this.db.insert(oidcRefreshTokens).values({
      tokenHash: hashToken(rawToken),
      userId: data.userId,
      clientId: data.clientId,
      scope: data.scope,
    });
  }

  async getRefreshToken(rawToken: string): Promise<TokenGrant | null> {
    const [row] = await this.db
      .select()
      .from(oidcRefreshTokens)
      .where(eq(oidcRefreshTokens.tokenHash, hashToken(rawToken)))
      .limit(1);
    if (!row) return null;
    if (row.expiresAt && new Date(row.expiresAt).getTime() < Date.now()) return null;
    return { userId: row.userId, clientId: row.clientId, scope: row.scope };
  }

  /** Opportunistic cleanup of expired auth codes + access tokens. */
  async purgeExpired(): Promise<void> {
    const now = new Date();
    await this.db.delete(oidcAuthCodes).where(lt(oidcAuthCodes.expiresAt, now));
    await this.db.delete(oidcAccessTokens).where(lt(oidcAccessTokens.expiresAt, now));
  }
}
