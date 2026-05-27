/**
 * Drizzle-backed IdentityStore — stub.
 *
 * `packages/db/src/schema/users.ts` already ships a real users schema
 * (~187 lines). The Drizzle implementation is a follow-up that:
 *
 *   1. Imports `users` + `tenantMemberships` from `@aivo/db`.
 *   2. Maps the row shapes to the web-v2 `User` / `TenantMembership`
 *      domain types in `mapRowToUser` / `mapRowToMembership` helpers.
 *   3. Wraps `getUserById` etc. in transactions where multi-row
 *      mutations happen (`addStaffUser` writes user + membership).
 *
 * Until the wiring lands, flipping AIVO_PERSISTENCE_IDENTITY=postgres
 * hits the explicit error below.
 */
import type { IdentityStore } from "../types";

function notImplemented(method: string): never {
  throw new Error(
    `[persistence.drizzle.identity.${method}] not implemented. ` +
      `Wire packages/db/src/schema/users.ts into the adapter before ` +
      `flipping AIVO_PERSISTENCE_IDENTITY=postgres.`,
  );
}

export const drizzleIdentity: IdentityStore = {
  async getUserById() {
    return notImplemented("getUserById");
  },
  async listUsersForTenants() {
    return notImplemented("listUsersForTenants");
  },
  async listMembershipsForUser() {
    return notImplemented("listMembershipsForUser");
  },
  async updateUserDisplayName() {
    return notImplemented("updateUserDisplayName");
  },
  async addStaffUser() {
    return notImplemented("addStaffUser");
  },
  async removeStaffUser() {
    return notImplemented("removeStaffUser");
  },
};
