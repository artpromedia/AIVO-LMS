/**
 * District staff invite registry — standalone globalThis store mirroring the
 * `team-invites` module pattern. Separate from `lib/db/store.ts` so we don't
 * have to thread new tables through the large repos/types files.
 *
 * Legacy reference: aivo-ai-learning's `POST /api/district/staff` returned
 * `{ temporaryPassword }` for a new account; we keep the same behavior here
 * for parity with how district admins onboard new staff in the wild.
 */
import { randomUUID } from "node:crypto";

export type StaffRole = "district_admin" | "school_admin" | "teacher";
export type StaffInviteStatus = "PENDING" | "ACCEPTED" | "REVOKED";

export type StaffInviteRecord = {
  id: string;
  tenantId: string;
  schoolId: string | null;
  email: string;
  role: StaffRole;
  displayName: string;
  temporaryPassword: string;
  invitedBy: string;
  invitedAt: string;
  status: StaffInviteStatus;
};

type Registry = {
  invites: StaffInviteRecord[];
};

declare global {
  // eslint-disable-next-line no-var
  var __aivoStaffInvites: Registry | undefined;
}

function registry(): Registry {
  if (!globalThis.__aivoStaffInvites) {
    globalThis.__aivoStaffInvites = { invites: [] };
  }
  return globalThis.__aivoStaffInvites;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function generatePassword(): string {
  const charset = "ABCDEFGHJKMNPQRSTUVWXYZ23456789abcdefghjkmnpqrstuvwxyz";
  let pw = "";
  for (let i = 0; i < 12; i++) {
    pw += charset[Math.floor(Math.random() * charset.length)];
  }
  return pw;
}

export type CreateStaffInviteInput = {
  tenantId: string;
  schoolId: string | null;
  email: string;
  role: StaffRole;
  displayName: string;
  invitedBy: string;
};

export type CreateStaffInviteResult =
  | { ok: true; record: StaffInviteRecord }
  | { ok: false; error: string };

export function createStaffInvite(input: CreateStaffInviteInput): CreateStaffInviteResult {
  const email = input.email.trim().toLowerCase();
  const displayName = input.displayName.trim();
  if (!EMAIL_RE.test(email)) return { ok: false, error: "Enter a valid email address." };
  if (!displayName) return { ok: false, error: "Enter the person's display name." };
  if (input.role !== "district_admin" && !input.schoolId) {
    return { ok: false, error: "Pick a school for this staff member." };
  }

  const reg = registry();
  const dupe = reg.invites.find(
    (i) => i.tenantId === input.tenantId && i.email === email && i.status === "PENDING"
  );
  if (dupe) return { ok: false, error: "An invitation is already pending for that email." };

  const record: StaffInviteRecord = {
    id: `inv_staff_${randomUUID()}`,
    tenantId: input.tenantId,
    schoolId: input.role === "district_admin" ? null : input.schoolId,
    email,
    role: input.role,
    displayName,
    temporaryPassword: generatePassword(),
    invitedBy: input.invitedBy,
    invitedAt: new Date().toISOString(),
    status: "PENDING",
  };
  reg.invites.push(record);
  return { ok: true, record };
}

export function listStaffInvitesForTenants(tenantIds: string[]): StaffInviteRecord[] {
  const set = new Set(tenantIds);
  return registry()
    .invites.filter((i) => set.has(i.tenantId) && i.status !== "REVOKED")
    .sort((a, b) => (a.invitedAt < b.invitedAt ? 1 : -1));
}

export function revokeStaffInvite(inviteId: string, tenantIds: string[]): boolean {
  const set = new Set(tenantIds);
  const target = registry().invites.find((i) => i.id === inviteId && set.has(i.tenantId));
  if (!target || target.status !== "PENDING") return false;
  target.status = "REVOKED";
  return true;
}
