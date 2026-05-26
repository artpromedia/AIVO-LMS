/**
 * Sprint 13: Teacher messages — thread list.
 *
 * Server component. Fetches via the BFF wrapper at
 * /api/bff/comms/threads which adds the active-tenant header and
 * relies on comms-svc to enforce boundary visibility.
 */
import Link from "next/link";
import { headers } from "next/headers";
import { requirePageRole } from "@/lib/auth/server";
import { AppShell } from "@/components/layout/app-shell";
import { PageHeader } from "@/components/layout/page-header";
import { TEACHER_NAV } from "@/components/layout/role-shells";
import { Card } from "@/components/ui/card";

export const dynamic = "force-dynamic";

interface ThreadRow {
  id: string;
  kind: string;
  learnerId: string | null;
  createdAt: string;
  updatedAt?: string | null;
  archivedAt?: string | null;
}

async function loadThreads(): Promise<ThreadRow[]> {
  const h = await headers();
  const host = h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? "http";
  const cookie = h.get("cookie") ?? "";
  try {
    const res = await fetch(`${proto}://${host}/api/bff/comms/threads`, {
      headers: { cookie },
      cache: "no-store",
    });
    if (!res.ok) return [];
    const body = (await res.json()) as { threads?: ThreadRow[] };
    return body.threads ?? [];
  } catch {
    return [];
  }
}

export default async function TeacherMessagesPage() {
  const session = await requirePageRole(["teacher"]);
  const threads = await loadThreads();
  return (
    <AppShell
      role="teacher"
      roleLabel="Teacher"
      navItems={TEACHER_NAV}
      user={{ displayName: session.displayName, email: session.email }}
    >
      <PageHeader
        eyebrow="Messages"
        title="Conversations"
        description="Parent threads, lesson chats, and therapist updates — scoped to one learner each."
      />
      {threads.length === 0 ? (
        <Card className="p-6 text-sm text-muted-foreground">
          No threads yet. Open a learner profile to start a parent conversation.
        </Card>
      ) : (
        <ul className="grid gap-3">
          {threads.map((t) => (
            <li key={t.id}>
              <Link
                href={`/teacher/messages/${t.id}`}
                className="block rounded-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              >
                <Card className="p-4 hover:shadow-md transition-shadow">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold capitalize">
                        {t.kind.replace(/_/g, " ")}
                      </p>
                      {t.learnerId && (
                        <p className="text-xs text-muted-foreground mt-1">
                          Learner {t.learnerId.slice(0, 8)}…
                        </p>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {new Date(t.updatedAt ?? t.createdAt).toLocaleString()}
                    </p>
                  </div>
                </Card>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </AppShell>
  );
}
