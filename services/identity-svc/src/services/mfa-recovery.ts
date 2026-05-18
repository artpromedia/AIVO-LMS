/**
 * Recovery code service: generate / store / verify single-use recovery codes
 * for an MFA-enabled user. Stored as argon2id hashes of the canonical
 * (uppercase, dash-stripped) code. Returns plaintext only at generation.
 */
import { eq, and, isNull } from "drizzle-orm";
import argon2 from "argon2";
import { mfaRecoveryCodes } from "@aivo/db";
import { generateRecoveryCodes, canonicalizeRecoveryCode } from "@aivo/security";

export const RECOVERY_CODE_COUNT = 10;

export async function regenerateRecoveryCodes(db: any, userId: string): Promise<string[]> {
  const { plain, canonical } = generateRecoveryCodes(RECOVERY_CODE_COUNT);
  // Invalidate every existing code (used or not) so we never have two active sets.
  await db.delete(mfaRecoveryCodes).where(eq(mfaRecoveryCodes.userId, userId));
  const rows = await Promise.all(
    canonical.map(async (c) => ({
      userId,
      codeHash: await argon2.hash(c),
    })),
  );
  await db.insert(mfaRecoveryCodes).values(rows);
  return plain;
}

export async function countActiveRecoveryCodes(db: any, userId: string): Promise<number> {
  const rows = await db
    .select()
    .from(mfaRecoveryCodes)
    .where(and(eq(mfaRecoveryCodes.userId, userId), isNull(mfaRecoveryCodes.usedAt)));
  return rows.length;
}

/**
 * Try to redeem a recovery code. Returns true on success and marks the
 * code used. We have to scan-and-verify because argon2 hashes are salted —
 * recovery code volume per user is fixed (10), so the cost is bounded.
 */
export async function redeemRecoveryCode(
  db: any,
  userId: string,
  rawInput: string,
): Promise<boolean> {
  const canonical = canonicalizeRecoveryCode(rawInput);
  if (canonical.length !== 12) return false;
  const rows = await db
    .select()
    .from(mfaRecoveryCodes)
    .where(and(eq(mfaRecoveryCodes.userId, userId), isNull(mfaRecoveryCodes.usedAt)));
  for (const row of rows) {
    let ok = false;
    try {
      ok = await argon2.verify(row.codeHash, canonical);
    } catch {
      ok = false;
    }
    if (ok) {
      await db
        .update(mfaRecoveryCodes)
        .set({ usedAt: new Date() })
        .where(eq(mfaRecoveryCodes.id, row.id));
      return true;
    }
  }
  return false;
}
