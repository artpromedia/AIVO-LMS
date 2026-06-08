/**
 * In-memory CollaborationStore — collaborator insights + accepted members.
 * Selected when AIVO_PERSISTENCE_COLLABORATION=memory (default).
 *
 * Backs the pre-build invite step's perspective capture and the brain
 * builder's insight read. Tenant-scoped on every call, mirroring the
 * drizzle adapter exactly so the shared contract holds for both.
 */
import { getStore } from "@/lib/db/store";
import type { CollaboratorInsight, CollaboratorMember } from "@/lib/db/types";
import type { CollaborationStore } from "../types";

export const memoryCollaboration: CollaborationStore = {
  async addInsight(insight: CollaboratorInsight) {
    getStore().collaboratorInsights.set(insight.id, insight);
    return insight;
  },

  async listInsightsForLearner(learnerId, tenantId) {
    const out: CollaboratorInsight[] = [];
    for (const i of getStore().collaboratorInsights.values()) {
      if (i.learnerId === learnerId && i.tenantId === tenantId) out.push(i);
    }
    // Newest first.
    return out.sort((a, b) => (a.createdAt < b.createdAt ? 1 : a.createdAt > b.createdAt ? -1 : 0));
  },

  async upsertMember(member: CollaboratorMember) {
    getStore().collaboratorMembers.set(member.id, member);
    return member;
  },

  async listAcceptedMembers(learnerId, tenantId) {
    const out: CollaboratorMember[] = [];
    for (const m of getStore().collaboratorMembers.values()) {
      if (m.learnerId === learnerId && m.tenantId === tenantId && m.status === "accepted") {
        out.push(m);
      }
    }
    return out;
  },

  async listMembersForLearner(learnerId, tenantId) {
    const out: CollaboratorMember[] = [];
    for (const m of getStore().collaboratorMembers.values()) {
      if (m.learnerId === learnerId && m.tenantId === tenantId) out.push(m);
    }
    return out;
  },

  async listMembersForTenant(tenantId) {
    const out: CollaboratorMember[] = [];
    for (const m of getStore().collaboratorMembers.values()) {
      if (m.tenantId === tenantId) out.push(m);
    }
    return out;
  },
};
