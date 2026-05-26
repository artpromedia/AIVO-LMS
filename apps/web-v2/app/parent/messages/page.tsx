/**
 * Sprint 13: Parent messages — thread list.
 *
 * Scoped to the active learner; the BFF injects active-learner via the
 * header so cross-learner threads never appear in this list.
 */
import Link from "next/link";
import { headers } from "next/headers";
import { requirePageRole } from "@/lib/auth/server";
import { AppShell } from "@/components/layout/app-shell";
import { PageHeader } from "@/components/layout/page-header";
import { PARENT_NAV } from "@/components/layout/role-shells";
import { Card } from "@/components/ui/card";

export const dynamic = "force-dynamic";

interface ThreadRow {
  id: string;
  kind: string;
  learnerId: string | null;
  createdAt: string;
  updatedAt?: string | null;
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

export default async function ParentMessagesPage() {
  const session = await requirePageRole(["parent"]);
  const threads = await loadThreads();
  return (
    <AppShell
      role="parent"
      roleLabel="Parent"
      navItems={PARENT_NAV}
      user={{ displayName: session.displayName, email: session.email }}
    >
      <PageHeader
        eyebrow="Messages"
        title="Your conversations"
        description="Each thread is about one of your learners. You won't see messages about other children."
      />
      {threads.length === 0 ? (
        <Card className="p-6 text-sm text-muted-foreground">
          No threads yet. Teachers and therapists can start a conversation about your learner.
        </Card>
      ) : (
        <ul className="grid gap-3">
          {threads.map((t) => (
            <li key={t.id}>
              <Link
                href={`/parent/messages/${t.id}`}
                className="block rounded-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              >
                <Card className="p-4 hover:shadow-md transition-shadow">
                  <div className="flex items-start justify-between gap-3">
                    <p className="font-semibold capitalize">
                      {t.kind.replace(/_/g, " ")}
                    </p>
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
