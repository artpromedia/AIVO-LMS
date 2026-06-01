import { userRoles } from "@aivo/db";
import { eq } from "drizzle-orm";

/**
 * Compute the roles a user may act as (ADR 0020 — single shell, multi-role):
 * the primary `users.role` plus any `user_roles` rows, de-duplicated with the
 * base role first. Emitted as `availableRoles` in the access-token JWT so the
 * unified shell can offer a role switch and the server can validate the
 * active-role header against the full set.
 */
export function mergeAvailableRoles(baseRole: string, extraRoles: readonly string[]): string[] {
  const out: string[] = [];
  for (const r of [baseRole, ...extraRoles]) {
    if (r && !out.includes(r)) out.push(r);
  }
  return out;
}

/**
 * Load the user's available roles from the DB. Degrades to `[baseRole]` if the
 * `user_roles` table is unavailable (e.g. before the migration runs), so a
 * single-role login is never broken by this lookup.
 */
export async function loadAvailableRoles(
  db: any,
  userId: string,
  baseRole: string,
): Promise<string[]> {
  try {
    const rows = await db
      .select({ role: userRoles.role })
      .from(userRoles)
      .where(eq(userRoles.userId, userId));
    return mergeAvailableRoles(
      baseRole,
      rows.map((r: { role: string }) => r.role),
    );
  } catch {
    return mergeAvailableRoles(baseRole, []);
  }
}
