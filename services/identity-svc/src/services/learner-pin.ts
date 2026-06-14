import argon2 from "argon2";
import { and, eq, sql } from "drizzle-orm";
import { learnerPinCredentials, learners, users } from "@aivo/db";

export const LEARNER_PIN_LOCK_THRESHOLD = 5;
export const LEARNER_PIN_LOCK_WINDOW_MS = 10 * 60 * 1000;
export const LEARNER_PIN_LOCK_MS = 15 * 60 * 1000;

export type PinVerifyResult =
  | { ok: true; learnerUser: typeof users.$inferSelect; learner: typeof learners.$inferSelect }
  | { ok: false; status: 401 | 404 | 423 | 429; error: string; retryAfterSeconds?: number };

function isValidPin(pin: unknown): pin is string {
  return typeof pin === "string" && /^\d{4,6}$/.test(pin);
}

function secondsUntil(date: Date): number {
  return Math.max(1, Math.ceil((date.getTime() - Date.now()) / 1000));
}

async function resolveParent(db: any, parentId: string) {
  const isEmail = parentId.includes("@");
  const [parent] = await db
    .select()
    .from(users)
    .where(and(isEmail ? eq(users.email, parentId.toLowerCase()) : eq(users.id, parentId), eq(users.role, "PARENT")))
    .limit(1);
  return parent ?? null;
}

async function findSelectedLearner(db: any, parentUserId: string, learnerId: string) {
  const [learner] = await db
    .select()
    .from(learners)
    .where(and(eq(learners.id, learnerId), eq(learners.parentId, parentUserId)))
    .limit(1);
  return learner ?? null;
}

async function findCredential(db: any, learnerUserId: string) {
  const [credential] = await db
    .select()
    .from(learnerPinCredentials)
    .where(eq(learnerPinCredentials.learnerUserId, learnerUserId))
    .limit(1);
  return credential ?? null;
}

export async function setLearnerPin(db: any, learnerUserId: string, rawPin: string) {
  if (!isValidPin(rawPin)) throw new Error("PIN must be 4–6 digits");
  const pinHash = await argon2.hash(rawPin, { type: argon2.argon2id });
  const now = new Date();
  await db
    .insert(learnerPinCredentials)
    .values({
      learnerUserId,
      pinHash,
      pinSetAt: now,
      failedAttempts: 0,
      failedLastAt: null,
      lockedUntil: null,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: learnerPinCredentials.learnerUserId,
      set: {
        pinHash,
        pinSetAt: now,
        failedAttempts: 0,
        failedLastAt: null,
        lockedUntil: null,
        updatedAt: now,
      },
    });
  // Defense-in-depth for legacy rows: the old plaintext users.pin column must
  // never remain populated after the new credential is set.
  await db.update(users).set({ pin: null, updatedAt: now }).where(eq(users.id, learnerUserId));
  return { learnerUserId, pinSetAt: now };
}

async function recordFailure(db: any, learnerUserId: string, current: any): Promise<{ locked: boolean; retryAfterSeconds?: number }> {
  const now = new Date();
  const last = current.failedLastAt ? new Date(current.failedLastAt) : null;
  const insideWindow = last ? now.getTime() - last.getTime() <= LEARNER_PIN_LOCK_WINDOW_MS : false;
  const nextAttempts = insideWindow ? Number(current.failedAttempts ?? 0) + 1 : 1;
  const lockedUntil = nextAttempts >= LEARNER_PIN_LOCK_THRESHOLD ? new Date(now.getTime() + LEARNER_PIN_LOCK_MS) : null;
  await db
    .update(learnerPinCredentials)
    .set({ failedAttempts: nextAttempts, failedLastAt: now, lockedUntil, updatedAt: now })
    .where(eq(learnerPinCredentials.learnerUserId, learnerUserId));
  return lockedUntil ? { locked: true, retryAfterSeconds: secondsUntil(lockedUntil) } : { locked: false };
}

export async function verifyLearnerPin(
  db: any,
  input: { parentId: string; learnerId: string; pin: string },
): Promise<PinVerifyResult> {
  if (!input.parentId || !input.learnerId || !isValidPin(input.pin)) {
    return { ok: false, status: 401, error: "Invalid PIN" };
  }
  const parent = await resolveParent(db, input.parentId);
  if (!parent) return { ok: false, status: 401, error: "Invalid parent email or ID" };
  const learner = await findSelectedLearner(db, parent.id, input.learnerId);
  if (!learner?.userId) return { ok: false, status: 401, error: "Invalid learner" };
  const [learnerUser] = await db
    .select()
    .from(users)
    .where(and(eq(users.id, learner.userId), eq(users.role, "LEARNER")))
    .limit(1);
  if (!learnerUser) return { ok: false, status: 401, error: "Invalid learner" };
  const credential = await findCredential(db, learner.userId);
  if (!credential) return { ok: false, status: 404, error: "PIN is not set for this learner" };
  if (credential.lockedUntil && new Date(credential.lockedUntil).getTime() > Date.now()) {
    return {
      ok: false,
      status: 429,
      error: "PIN temporarily locked",
      retryAfterSeconds: secondsUntil(new Date(credential.lockedUntil)),
    };
  }
  const verified = await argon2.verify(credential.pinHash, input.pin);
  if (!verified) {
    const failure = await recordFailure(db, learner.userId, credential);
    return {
      ok: false,
      status: failure.locked ? 429 : 401,
      error: failure.locked ? "PIN temporarily locked" : "Invalid PIN",
      retryAfterSeconds: failure.retryAfterSeconds,
    };
  }
  await db
    .update(learnerPinCredentials)
    .set({ failedAttempts: 0, failedLastAt: null, lockedUntil: null, updatedAt: new Date() })
    .where(eq(learnerPinCredentials.learnerUserId, learner.userId));
  return { ok: true, learnerUser, learner };
}

export async function plaintextPinRowsRemaining(db: any): Promise<number> {
  const result: any = await db.execute(sql`SELECT count(*)::int AS n FROM users WHERE role = 'LEARNER' AND pin ~ '^[0-9]{4,6}$'`);
  const row = (Array.isArray(result) ? result : result.rows)[0];
  return Number(row?.n ?? 0);
}
