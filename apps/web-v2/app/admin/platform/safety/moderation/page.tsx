import { requirePageRole } from "@/lib/auth/server";
import { AppShell } from "@/components/layout/app-shell";
import { PageHeader } from "@/components/layout/page-header";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PLATFORM_NAV } from "@/components/layout/role-shells";
import { listModerationEvents } from "@/lib/db/repos";

export const dynamic = "force-dynamic";

function toneFor(decision: "allow" | "review" | "block") {
  return decision === "block" ? "danger" : decision === "review" ? "warning" : "success";
}

export default async function Page() {
  const session = await requirePageRole(["platform_admin"]);
  const events = listModerationEvents({ limit: 200 });
  return (
    <AppShell
      role="platform_admin"
      roleLabel="Platform admin"
      navItems={PLATFORM_NAV}
      user={{ displayName: session.displayName, email: session.email }}
    >
      <PageHeader
        eyebrow="Safety"
        title="Moderation events"
        description="Every classification with decision review or block. Allow-decisions are recorded only at debug level."
      />
      <Card className="p-0 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-aivo-surface-2 text-xs uppercase text-aivo-muted">
            <tr>
              <th className="px-4 py-2 text-left">When</th>
              <th className="px-4 py-2 text-left">Subject</th>
              <th className="px-4 py-2 text-left">Decision</th>
              <th className="px-4 py-2 text-left">Categories</th>
              <th className="px-4 py-2 text-left">Severity</th>
              <th className="px-4 py-2 text-left">Excerpt</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {events.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-6 text-center text-aivo-muted">
                  No moderation events recorded yet.
                </td>
              </tr>
            ) : (
              events.map((e) => (
                <tr key={e.id}>
                  <td className="px-4 py-2 text-[11px] text-aivo-muted whitespace-nowrap">
                    {new Date(e.createdAt).toLocaleString()}
                  </td>
                  <td className="px-4 py-2">{e.subjectKind.replace(/_/g, " ")}</td>
                  <td className="px-4 py-2">
                    <Badge tone={toneFor(e.classification.decision)}>
                      {e.classification.decision}
                    </Badge>
                  </td>
                  <td className="px-4 py-2">
                    <div className="flex flex-wrap gap-1">
                      {e.classification.categories.map((c) => (
                        <Badge key={c} tone="neutral">
                          {c.replace(/_/g, " ")}
                        </Badge>
                      ))}
                    </div>
                  </td>
                  <td className="px-4 py-2 text-xs">{e.classification.severity}</td>
                  <td className="px-4 py-2 text-xs text-aivo-muted">
                    {e.excerpt.slice(0, 120)}
                    {e.excerpt.length > 120 ? "…" : ""}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </Card>
    </AppShell>
  );
}
