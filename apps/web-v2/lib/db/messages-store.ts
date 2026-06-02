/**
 * In-memory threaded-messaging store — the dev/mock fallback for the
 * `/messages` inbox (mirrors the billing / consent dual-path). In production
 * (`AIVO_USE_COMMS_SVC` / `AIVO_USE_SERVICE_STACK` on + a real token) the BFF
 * talks to comms-svc's `message_threads` / `messages` tables instead.
 *
 * Seeded with one demo thread for the mock parent/teacher so the inbox
 * demonstrates list → open → reply without a backend. Process-local.
 */

export interface StoreThread {
  id: string;
  tenantId: string;
  subject: string;
  learnerId: string | null;
  createdByUserId: string;
  participantUserIds: string[];
  createdAt: string;
  lastMessageAt: string;
}

export interface StoreMessage {
  id: string;
  threadId: string;
  senderUserId: string;
  body: string;
  createdAt: string;
}

const threads = new Map<string, StoreThread>();
const messagesByThread = new Map<string, StoreMessage[]>();
const lastRead = new Map<string, string>(); // `${threadId}:${userId}` -> ISO

function id(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

// --- demo seed ---------------------------------------------------------
(function seed() {
  const threadId = "thr_demo_reading";
  const now = Date.now();
  threads.set(threadId, {
    id: threadId,
    tenantId: "t_demo",
    subject: "Reading progress for Sky",
    learnerId: "lrn_demo_sky",
    createdByUserId: "u_teacher_1",
    participantUserIds: ["u_parent_1", "u_teacher_1"],
    createdAt: new Date(now - 86400000).toISOString(),
    lastMessageAt: new Date(now - 3600000).toISOString(),
  });
  messagesByThread.set(threadId, [
    {
      id: "msg_demo_1",
      threadId,
      senderUserId: "u_teacher_1",
      body: "Hi! Sky did great on this week's reading — finished two extra chapters.",
      createdAt: new Date(now - 7200000).toISOString(),
    },
    {
      id: "msg_demo_2",
      threadId,
      senderUserId: "u_teacher_1",
      body: "Want me to send a few at-home practice ideas?",
      createdAt: new Date(now - 3600000).toISOString(),
    },
  ]);
})();

// --- queries -----------------------------------------------------------

function isParticipant(thread: StoreThread, userId: string): boolean {
  return thread.participantUserIds.includes(userId);
}

export function listThreads(tenantId: string, userId: string) {
  return [...threads.values()]
    .filter((t) => t.tenantId === tenantId && isParticipant(t, userId))
    .sort((a, b) => b.lastMessageAt.localeCompare(a.lastMessageAt))
    .map((t) => {
      const msgs = messagesByThread.get(t.id) ?? [];
      const last = msgs[msgs.length - 1] ?? null;
      const lr = lastRead.get(`${t.id}:${userId}`) ?? null;
      const unread = msgs.filter(
        (m) => m.senderUserId !== userId && (!lr || m.createdAt > lr),
      ).length;
      return {
        id: t.id,
        subject: t.subject,
        learnerId: t.learnerId,
        lastMessageAt: t.lastMessageAt,
        unread,
        participantUserIds: t.participantUserIds,
        lastMessage: last
          ? { body: last.body, senderUserId: last.senderUserId, createdAt: last.createdAt }
          : null,
      };
    });
}

export function getThreadMessages(threadId: string, tenantId: string, userId: string) {
  const thread = threads.get(threadId);
  if (!thread || thread.tenantId !== tenantId || !isParticipant(thread, userId)) return null;
  const msgs = messagesByThread.get(threadId) ?? [];
  return {
    threadId,
    subject: thread.subject,
    participantUserIds: thread.participantUserIds,
    messages: msgs.map((m) => ({
      id: m.id,
      senderUserId: m.senderUserId,
      body: m.body,
      createdAt: m.createdAt,
      mine: m.senderUserId === userId,
    })),
  };
}

export function sendMessage(threadId: string, tenantId: string, userId: string, body: string) {
  const thread = threads.get(threadId);
  if (!thread || thread.tenantId !== tenantId || !isParticipant(thread, userId)) return null;
  const msg: StoreMessage = {
    id: id("msg"),
    threadId,
    senderUserId: userId,
    body,
    createdAt: new Date().toISOString(),
  };
  const list = messagesByThread.get(threadId) ?? [];
  list.push(msg);
  messagesByThread.set(threadId, list);
  thread.lastMessageAt = msg.createdAt;
  lastRead.set(`${threadId}:${userId}`, msg.createdAt);
  return { ...msg, mine: true };
}

export function markRead(threadId: string, tenantId: string, userId: string) {
  const thread = threads.get(threadId);
  if (!thread || thread.tenantId !== tenantId || !isParticipant(thread, userId)) return false;
  lastRead.set(`${threadId}:${userId}`, new Date().toISOString());
  return true;
}

export function createThread(
  tenantId: string,
  userId: string,
  input: {
    subject: string;
    participantUserIds: string[];
    learnerId?: string | null;
    body?: string;
  },
) {
  const tId = id("thr");
  const members = Array.from(new Set([userId, ...input.participantUserIds]));
  const nowIso = new Date().toISOString();
  threads.set(tId, {
    id: tId,
    tenantId,
    subject: input.subject,
    learnerId: input.learnerId ?? null,
    createdByUserId: userId,
    participantUserIds: members,
    createdAt: nowIso,
    lastMessageAt: nowIso,
  });
  messagesByThread.set(tId, []);
  if (input.body) sendMessage(tId, tenantId, userId, input.body);
  return { id: tId, subject: input.subject, participantUserIds: members };
}
