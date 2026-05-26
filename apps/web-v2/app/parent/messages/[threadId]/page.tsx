/**
 * Sprint 13: Parent thread view.
 */
import { headers } from "next/headers";
import { requirePageRole } from "@/lib/auth/server";
import { AppShell } from "@/components/layout/app-shell";
import { PageHeader } from "@/components/layout/page-header";
import { PARENT_NAV } from "@/components/layout/role-shells";
import { Card } from "@/components/ui/card";

export const dynamic = "force-dynamic";

interface Message {
  id: string;
  authorId: string;
  body: string;
  createdAt: string;
}

async function loadMessages(threadId: string): Promise<{ messages: Message[]; ok: boolean }> {
  const h = await headers();
  const host = h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? "http";
  const cookie = h.get("cookie") ?? "";
  try {
    const res = await fetch(
      `${proto}://${host}/api/bff/comms/threads/${threadId}/messages`,
      { headers: { cookie }, cache: "no-store" },
    );
    if (!res.ok) return { messages: [], ok: false };
    const body = (await res.json()) as { messages?: Message[] };
    return { messages: body.messages ?? [], ok: true };
  } catch {
    return { messages: [], ok: false };
  }
}

export default async function ParentThreadPage({
  params,
}: {
  params: Promise<{ threadId: string }>;
}) {
  const session = await requirePageRole(["parent"]);
  const { threadId } = await params;
  const { messages, ok } = await loadMessages(threadId);
  return (
    <AppShell
      role="parent"
      roleLabel="Parent"
      navItems={PARENT_NAV}
      user={{ displayName: session.displayName, email: session.email }}
    >
      <PageHeader eyebrow="Thread" title="Conversation" />
      {!ok ? (
        <Card className="p-6 text-sm text-muted-foreground">
          You do not have access to this thread.
        </Card>
      ) : messages.length === 0 ? (
        <Card className="p-6 text-sm text-muted-foreground">No messages yet.</Card>
      ) : (
        <ul className="grid gap-2">
          {messages.map((m) => (
            <li key={m.id}>
              <Card className="p-3">
                <p className="text-xs text-muted-foreground mb-1">
                  {m.authorId.slice(0, 8)}… · {new Date(m.createdAt).toLocaleString()}
                </p>
                <p className="text-sm whitespace-pre-wrap">{m.body}</p>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </AppShell>
  );
}
