/**
 * Impersonation session store (Sprint 9).
 *
 * The authoritative table is `impersonation_sessions` (Drizzle schema +
 * migration 0049). identity-svc keeps an in-process index for fast active /
 * history lookups and so the route layer is unit-testable without a DB. A
 * DB-backed implementation mirrors this interface.
 */
import { randomUUID } from "node:crypto";

export interface ImpersonationSession {
  id: string;
  actorId: string;
  subjectId: string;
  tenantId: string;
  startedAt: string;
  endsAt: string;
  endedAt: string | null;
  reason: string;
  allowWrites: boolean;
  consentBasis: string | null;
  ip: string | null;
  ua: string | null;
  justificationTicketId: string | null;
}

export interface ImpersonationStore {
  create(session: Omit<ImpersonationSession, "id">): ImpersonationSession;
  get(id: string): ImpersonationSession | undefined;
  end(id: string, endedAt: string): ImpersonationSession | undefined;
  activeForActor(actorId: string, now?: number): ImpersonationSession | undefined;
  historyForActor(actorId: string): ImpersonationSession[];
  all(): ImpersonationSession[];
}

export function createInMemoryImpersonationStore(): ImpersonationStore {
  const byId = new Map<string, ImpersonationSession>();

  return {
    create(input) {
      const session: ImpersonationSession = { id: `imp_${randomUUID()}`, ...input };
      byId.set(session.id, session);
      return session;
    },
    get(id) {
      return byId.get(id);
    },
    end(id, endedAt) {
      const s = byId.get(id);
      if (!s) return undefined;
      s.endedAt = endedAt;
      byId.set(id, s);
      return s;
    },
    activeForActor(actorId, now = Date.now()) {
      const nowMs = now;
      return [...byId.values()].find(
        (s) =>
          s.actorId === actorId &&
          s.endedAt === null &&
          new Date(s.endsAt).getTime() > nowMs,
      );
    },
    historyForActor(actorId) {
      return [...byId.values()]
        .filter((s) => s.actorId === actorId)
        .sort((a, b) => b.startedAt.localeCompare(a.startedAt));
    },
    all() {
      return [...byId.values()].sort((a, b) => b.startedAt.localeCompare(a.startedAt));
    },
  };
}

/** Process-wide default store (replaced by DB-backed impl in production). */
let singleton: ImpersonationStore | null = null;
export function getImpersonationStore(): ImpersonationStore {
  if (!singleton) singleton = createInMemoryImpersonationStore();
  return singleton;
}
export function resetImpersonationStore(): ImpersonationStore {
  singleton = createInMemoryImpersonationStore();
  return singleton;
}
