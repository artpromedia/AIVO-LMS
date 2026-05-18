/**
 * WebAuthn helpers — RP identity selection and challenge envelope signing.
 *
 * RP ID rules:
 *   - production: pin to the apex `aivolearning.com` so credentials work
 *     across admin.aivolearning.com / district.aivolearning.com / app.
 *   - dev / replit: derive from the request host so passkeys work locally.
 *
 * Challenge envelopes are short-lived signed JWTs so we don't need a
 * server-side challenge store.
 */
import { signJWT, verifyJWT, type WebauthnChallengeJWT } from "@aivo/security";

const PROD_RP_ID = process.env.WEBAUTHN_RP_ID || "aivolearning.com";
const PROD_RP_NAME = process.env.WEBAUTHN_RP_NAME || "AIVO Learning";

export function getRpId(req: { headers: Record<string, string | string[] | undefined> }): string {
  if (process.env.WEBAUTHN_RP_ID) return process.env.WEBAUTHN_RP_ID;
  if (process.env.NODE_ENV === "production") return PROD_RP_ID;
  const rawHost = (req.headers["x-forwarded-host"] || req.headers.host) as string | undefined;
  const host = rawHost?.split(":")[0]?.toLowerCase() || "localhost";
  if (/aivolearning\.com$/i.test(host)) return PROD_RP_ID;
  return host; // localhost / *.replit.dev / *.repl.co — RP ID = full host
}

export function getRpName(): string {
  return PROD_RP_NAME;
}

const DEFAULT_PROD_ORIGINS = [
  "https://aivolearning.com",
  "https://www.aivolearning.com",
  "https://app.aivolearning.com",
  "https://admin.aivolearning.com",
  "https://district.aivolearning.com",
];

export function getExpectedOrigin(req: {
  headers: Record<string, string | string[] | undefined>;
}): string[] {
  const fromEnv = process.env.WEBAUTHN_ORIGINS;
  if (fromEnv)
    return fromEnv
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);

  // Production: strict static allow-list only. We deliberately do NOT
  // derive an origin from request headers — that would let a bad
  // x-forwarded-host bypass origin pinning, which is the entire point
  // of the WebAuthn check. Override via WEBAUTHN_ORIGINS env if you
  // need additional origins.
  if (process.env.NODE_ENV === "production") {
    return [...DEFAULT_PROD_ORIGINS];
  }

  // Dev / replit only — localhost fallbacks are intentionally gated to non-prod.
  const proto = (req.headers["x-forwarded-proto"] as string) || "https";
  const rawHost = (req.headers["x-forwarded-host"] || req.headers.host) as string | undefined;
  const host = rawHost?.split(",")[0]?.trim() || "localhost:5000";
  return [`${proto}://${host}`, `http://localhost:5000`, `http://localhost:3000`];
}

const CHALLENGE_TTL = "5m";

export async function signWebauthnChallenge(opts: {
  userId: string;
  challenge: string;
  purpose: "register" | "login";
}): Promise<string> {
  const claims: WebauthnChallengeJWT = {
    sub: opts.userId,
    tenantId: "",
    role: "",
    challenge: opts.challenge,
    purpose: `webauthn-${opts.purpose}`,
  };
  return signJWT<WebauthnChallengeJWT>(claims, CHALLENGE_TTL);
}

export async function verifyWebauthnChallengeToken(
  token: string,
  expectedPurpose: "register" | "login",
): Promise<{ userId: string; challenge: string }> {
  const payload = await verifyJWT<WebauthnChallengeJWT>(token);
  if (payload.purpose !== `webauthn-${expectedPurpose}`) {
    throw new Error("Invalid challenge purpose");
  }
  if (typeof payload.challenge !== "string" || !payload.challenge) {
    throw new Error("Challenge missing");
  }
  return { userId: payload.sub, challenge: payload.challenge };
}
