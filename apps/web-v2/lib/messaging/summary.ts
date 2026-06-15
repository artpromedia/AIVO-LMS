/**
 * Server-side messages summary for the parent Home card. Reuses the same
 * dual-path the inbox BFF uses (comms-svc when enabled + a token is present,
 * else the in-memory store) and degrades to an empty summary on any failure so
 * Home never breaks on a comms hiccup.
 */
import { getCommsBearer, isCommsSvcEnabled, listThreadsSvc } from "@/lib/bff/comms-svc";
import { listThreads } from "@/lib/db/messages-store";

export type MessagesSummary = {
  total: number;
  unread: number;
  latest: { subject: string; snippet: string | null; at: string } | null;
};

type ThreadRow = {
  id: string;
  subject: string;
  lastMessageAt: string;
  unread?: number;
  lastMessage?: { body: string; senderUserId: string; createdAt: string } | null;
};

export async function getParentMessagesSummary(session: {
  userId: string;
  tenantId: string;
}): Promise<MessagesSummary> {
  let threads: ThreadRow[] = [];
  try {
    const bearer = await getCommsBearer();
    if (isCommsSvcEnabled() && bearer) {
      const r = await listThreadsSvc(bearer);
      threads = r.ok ? ((r.data.threads as ThreadRow[]) ?? []) : [];
    } else {
      threads = listThreads(session.tenantId, session.userId) as ThreadRow[];
    }
  } catch {
    threads = [];
  }
  const unread = threads.reduce((acc, t) => acc + (t.unread ?? 0), 0);
  // Both paths return threads newest-first.
  const top = threads[0];
  const latest = top
    ? { subject: top.subject, snippet: top.lastMessage?.body ?? null, at: top.lastMessageAt }
    : null;
  return { total: threads.length, unread, latest };
}
