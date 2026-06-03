/**
 * Household + co-parent invite registry — the dev/mock backend for the
 * `/onboarding/parent-setup` step (gap #7, slice 4).
 *
 * The parent-setup step collects two things the funnel used to discard on
 * navigation: a household display name (shown to teachers when they message the
 * family) and an optional co-parent / caregiver email to invite. This in-memory
 * singleton stands in for the eventual Postgres `households` / `household_invites`
 * tables, mirroring the pattern every other web-v2 dataset uses until the real
 * backend is wired.
 *
 * Unlike the learner-scoped care-team invites in `team-invites.ts`, a co-parent
 * invited here is household-scoped: at parent-setup no learner exists yet, so the
 * invite attaches to the household and is later resolved to the learners the
 * co-parent is added to.
 */
import type { ID, ISODate } from "@/lib/db/types";

export type CoParentInviteStatus = "PENDING" | "ACCEPTED" | "REVOKED";

export type CoParentInvite = {
  id: ID;
  /** invitee email, lowercased */
  email: string;
  invitedAt: ISODate;
  status: CoParentInviteStatus;
};

export type Household = {
  /** Owning parent user id. */
  ownerUserId: ID;
  tenantId: ID;
  /** Free-form display name; null when the parent left it blank. */
  name: string | null;
  invites: CoParentInvite[];
  updatedAt: ISODate;
};

type Tables = {
  /** Keyed by owning parent user id. */
  households: Map<ID, Household>;
};

declare global {
  // Module-scoped singleton, sibling to globalThis.__aivoStore.
  var __aivoHouseholdStore: Tables | undefined;
}

function tables(): Tables {
  if (!globalThis.__aivoHouseholdStore) {
    globalThis.__aivoHouseholdStore = { households: new Map() };
  }
  return globalThis.__aivoHouseholdStore;
}

function nowIso(): ISODate {
  return new Date().toISOString();
}

function newInviteId(): ID {
  return `cpi_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`;
}

export function normalizeEmail(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const email = raw.trim().toLowerCase();
  if (!email) return null;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : null;
}

function ensure(ownerUserId: ID, tenantId: ID): Household {
  const t = tables();
  let h = t.households.get(ownerUserId);
  if (!h) {
    h = { ownerUserId, tenantId, name: null, invites: [], updatedAt: nowIso() };
    t.households.set(ownerUserId, h);
  }
  return h;
}

/** Persist (or clear) the household display name. */
export function setHouseholdName(ownerUserId: ID, tenantId: ID, name: string | null): Household {
  const h = ensure(ownerUserId, tenantId);
  const trimmed = name?.trim() ?? "";
  h.name = trimmed.length ? trimmed.slice(0, 120) : null;
  h.updatedAt = nowIso();
  return h;
}

export type AddCoParentResult =
  | { ok: true; invite: CoParentInvite }
  | { ok: false; error: string; status: 409 };

/**
 * Record a co-parent invite for the household. Idempotent per email: a pending
 * invite for the same address is returned as a conflict rather than duplicated.
 */
export function addCoParentInvite(
  ownerUserId: ID,
  tenantId: ID,
  email: string,
): AddCoParentResult {
  const h = ensure(ownerUserId, tenantId);
  const existing = h.invites.find((i) => i.email === email && i.status === "PENDING");
  if (existing) {
    return { ok: false, error: "That co-parent is already invited.", status: 409 };
  }
  const invite: CoParentInvite = {
    id: newInviteId(),
    email,
    invitedAt: nowIso(),
    status: "PENDING",
  };
  h.invites.push(invite);
  h.updatedAt = nowIso();
  return { ok: true, invite };
}

export type HouseholdView = {
  name: string | null;
  invites: { id: ID; email: string; status: CoParentInviteStatus; invitedAt: ISODate }[];
};

export function getHousehold(ownerUserId: ID): HouseholdView {
  const h = tables().households.get(ownerUserId);
  if (!h) return { name: null, invites: [] };
  return {
    name: h.name,
    invites: h.invites
      .filter((i) => i.status !== "REVOKED")
      .map((i) => ({ id: i.id, email: i.email, status: i.status, invitedAt: i.invitedAt })),
  };
}

/** Test/dev helper — wipes the store. */
export function _resetHouseholdStore(): void {
  globalThis.__aivoHouseholdStore = { households: new Map() };
}
