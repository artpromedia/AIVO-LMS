import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import type { Role, SessionProfile } from "@/lib/auth/types";
import { requirePageRole } from "@/lib/auth/server";
import { serverEnv } from "@/lib/env";

export const LEARNER_SESSION_COOKIE = "aivo_learner_session";
const TTL_SECONDS = 60 * 60 * 8;

type LearnerSessionToken = {
  parentUserId: string;
  learnerId: string;
  tenantId: string;
  actsAsLearner: true;
  iat: number;
  exp: number;
};

export type LearnerSession = Omit<LearnerSessionToken, "iat" | "exp">;

function base64url(input: string | Buffer): string {
  return Buffer.from(input)
    .toString("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}

function decodeBase64url(input: string): Buffer {
  const normalized = input.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized + "=".repeat((4 - (normalized.length % 4)) % 4);
  return Buffer.from(padded, "base64");
}

function sign(input: string): string {
  return base64url(
    createHmac("sha256", serverEnv.SESSION_SECRET ?? "dev-session-secret-please-change-me")
      .update(input)
      .digest(),
  );
}

function mintToken(payload: LearnerSessionToken): string {
  const encodedHeader = base64url(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const encodedPayload = base64url(JSON.stringify(payload));
  const signingInput = `${encodedHeader}.${encodedPayload}`;
  const signature = sign(signingInput);
  return `${signingInput}.${signature}`;
}

function verifyToken(token: string): LearnerSessionToken | null {
  const [h, p, s] = token.split(".");
  if (!h || !p || !s) return null;
  const expected = sign(`${h}.${p}`);
  const sig = Buffer.from(s);
  const exp = Buffer.from(expected);
  if (sig.length !== exp.length || !timingSafeEqual(sig, exp)) return null;
  try {
    const payload = JSON.parse(decodeBase64url(p).toString("utf8")) as Partial<LearnerSessionToken>;
    if (
      typeof payload.parentUserId !== "string" ||
      typeof payload.learnerId !== "string" ||
      typeof payload.tenantId !== "string" ||
      payload.actsAsLearner !== true ||
      typeof payload.iat !== "number" ||
      typeof payload.exp !== "number"
    ) {
      return null;
    }
    if (payload.exp <= Math.floor(Date.now() / 1000)) return null;
    return payload as LearnerSessionToken;
  } catch {
    return null;
  }
}

function parseCookieHeader(cookieHeader: string | null): string | null {
  if (!cookieHeader) return null;
  for (const part of cookieHeader.split(/;\s*/)) {
    const [k, ...rest] = part.split("=");
    if (k === LEARNER_SESSION_COOKIE) return rest.join("=");
  }
  return null;
}

export function createLearnerSessionCookie(
  parentUserId: string,
  learnerId: string,
  tenantId: string,
): string {
  const iat = Math.floor(Date.now() / 1000);
  const token = mintToken({
    parentUserId,
    learnerId,
    tenantId,
    actsAsLearner: true,
    iat,
    exp: iat + TTL_SECONDS,
  });
  const attrs = [
    `${LEARNER_SESSION_COOKIE}=${token}`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    `Max-Age=${TTL_SECONDS}`,
  ];
  if (process.env.NODE_ENV === "production") attrs.push("Secure");
  return attrs.join("; ");
}

export function clearLearnerSessionCookie(): string {
  const attrs = [
    `${LEARNER_SESSION_COOKIE}=`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    "Max-Age=0",
  ];
  if (process.env.NODE_ENV === "production") attrs.push("Secure");
  return attrs.join("; ");
}

export async function readLearnerSessionFromCookies(): Promise<LearnerSession | null> {
  const jar = await cookies();
  const token = jar.get(LEARNER_SESSION_COOKIE)?.value;
  const verified = token ? verifyToken(token) : null;
  if (!verified) return null;
  const { parentUserId, learnerId, tenantId, actsAsLearner } = verified;
  return { parentUserId, learnerId, tenantId, actsAsLearner };
}

export function readLearnerSession(req: Request): LearnerSession | null {
  const token = parseCookieHeader(req.headers.get("cookie"));
  const verified = token ? verifyToken(token) : null;
  if (!verified) return null;
  const { parentUserId, learnerId, tenantId, actsAsLearner } = verified;
  return { parentUserId, learnerId, tenantId, actsAsLearner };
}

export async function requireLearnerSession(
  roles: Role[] = ["learner"],
): Promise<SessionProfile & { actsAsLearner?: true; parentUserId?: string }> {
  const session = await requirePageRole(["learner", "parent"]);
  if (session.role === "learner") {
    return await requirePageRole(["learner"]);
  }
  const learnerSession = await readLearnerSessionFromCookies();
  if (
    learnerSession &&
    learnerSession.actsAsLearner &&
    learnerSession.parentUserId === session.userId &&
    learnerSession.tenantId === session.tenantId
  ) {
    return {
      ...session,
      role: "learner",
      learnerId: learnerSession.learnerId,
      actsAsLearner: true,
      parentUserId: learnerSession.parentUserId,
    };
  }
  if (roles.includes("parent")) {
    return session;
  }
  redirect("/parent/home");
}
