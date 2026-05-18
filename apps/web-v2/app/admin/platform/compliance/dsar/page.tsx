import { requirePageRole } from "@/lib/auth/server";
import { AppShell } from "@/components/layout/app-shell";
import { PageHeader } from "@/components/layout/page-header";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PLATFORM_NAV } from "@/components/layout/role-shells";
import { listAllDataExportRequests, listAllDataDeletionRequests } from "@/lib/db/repos";

export const dynamic = "force-dynamic";

function statusTone(s: string): "success" | "warning" | "neutral" | "danger" {
  if (s === "completed") return "success";
  if (s === "denied") return "danger";
  if (s === "in_progress" || s === "approved") return "warning";
  return "neutral";
}

export default async function Page() {
  const session = await requirePageRole(["platform_admin"]);
  const exports = listAllDataExportRequests();
  const deletes = listAllDataDeletionRequests();

  return (
    <AppShell
      role="platform_admin"
      roleLabel="Platform admin"
      navItems={PLATFORM_NAV}
      user={{ displayName: session.displayName, email: session.email }}
    >
      <PageHeader
        eyebrow="Platform · Compliance"
        title="Data subject requests"
        description="Every parent-initiated export and deletion request. Acceptance / completion is handled outside the demo store."
      />

      <Card className="mt-2 overflow-hidden">
        <header className="bg-aivo-surface-2 p-3 font-display font-semibold">
          Export requests ({exports.length})
        </header>
        <table className="w-full text-sm">
          <thead className="text-left">
            <tr>
              <th className="p-3">Requested</th>
              <th className="p-3">Parent</th>
              <th className="p-3">Learner</th>
              <th className="p-3">Status</th>
              <th className="p-3">Completed</th>
            </tr>
          </thead>
          <tbody>
            {exports.length === 0 ? (
              <tr>
                <td colSpan={5} className="p-6 text-center text-aivo-ink-soft">
                  No requests.
                </td>
              </tr>
            ) : (
              exports.map((r) => (
                <tr key={r.id} className="border-t border-aivo-border">
                  <td className="p-3 text-aivo-ink-soft">
                    {new Date(r.requestedAt).toLocaleString()}
                  </td>
                  <td className="p-3 font-mono text-xs">{r.parentUserId}</td>
                  <td className="p-3 font-mono text-xs">{r.learnerId ?? "—"}</td>
                  <td className="p-3">
                    <Badge tone={statusTone(r.status)}>{r.status}</Badge>
                  </td>
                  <td className="p-3 text-aivo-ink-soft">
                    {r.completedAt ? new Date(r.completedAt).toLocaleString() : "—"}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </Card>

      <Card className="mt-4 overflow-hidden">
        <header className="bg-aivo-surface-2 p-3 font-display font-semibold">
          Deletion requests ({deletes.length})
        </header>
        <table className="w-full text-sm">
          <thead className="text-left">
            <tr>
              <th className="p-3">Requested</th>
              <th className="p-3">Parent</th>
              <th className="p-3">Scope</th>
              <th className="p-3">Target</th>
              <th className="p-3">Status</th>
            </tr>
          </thead>
          <tbody>
            {deletes.length === 0 ? (
              <tr>
                <td colSpan={5} className="p-6 text-center text-aivo-ink-soft">
                  No requests.
                </td>
              </tr>
            ) : (
              deletes.map((r) => (
                <tr key={r.id} className="border-t border-aivo-border">
                  <td className="p-3 text-aivo-ink-soft">
                    {new Date(r.requestedAt).toLocaleString()}
                  </td>
                  <td className="p-3 font-mono text-xs">{r.parentUserId}</td>
                  <td className="p-3">{r.scope}</td>
                  <td className="p-3 font-mono text-xs">{r.learnerId ?? "—"}</td>
                  <td className="p-3">
                    <Badge tone={statusTone(r.status)}>{r.status}</Badge>
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
