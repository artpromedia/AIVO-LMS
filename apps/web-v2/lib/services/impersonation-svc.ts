/**
 * identity-svc Secure Impersonation client (Sprint — View As).
 *
 * Reads fall back to an empty array so the platform / district View-As log
 * pages render in the local/demo workflow with identity-svc unavailable.
 * Writes go through the BFF routes, not this file.
 */
import { serverEnv } from "@/lib/env";
import { callService } from "./client";

const IDENTITY = "identity-svc";
const identityBase = () => serverEnv.IDENTITY_SVC_URL;

export interface ImpersonationSession {
  id: string;
  actorId: string;
  actorName?: string;
  actorRole?: string;
  subjectId: string;
  subjectName?: string;
  subjectRole?: string;
  reason: string;
  basis?: string;
  allowWrites: boolean;
  ip?: string;
  startedAt: string;
  endedAt?: string | null;
}

/**
 * Fetch impersonation history. `scope.adminId` narrows to a single actor
 * (platform admins may pass it); identity-svc scopes non-platform callers to
 * their own history server-side regardless. Empty array on any failure.
 */
export async function getImpersonationHistory(
  scope: { adminId?: string; requestId?: string } = {},
): Promise<ImpersonationSession[]> {
  const qs = scope.adminId ? `?adminId=${encodeURIComponent(scope.adminId)}` : "";
  const res = await callService<{ sessions: ImpersonationSession[] }>({
    service: IDENTITY,
    baseUrl: identityBase(),
    url: `/api/impersonation/history${qs}`,
    requestId: scope.requestId,
  });
  return res.ok ? (res.data.sessions ?? []) : [];
}
