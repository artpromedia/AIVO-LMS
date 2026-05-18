import { requirePageRole } from "@/lib/auth/server";
import { AppShell } from "@/components/layout/app-shell";
import { PageHeader } from "@/components/layout/page-header";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PARENT_NAV } from "@/components/layout/role-shells";
import { listDataDeletionRequestsForUser, listLearnersForParent } from "@/lib/db/repos";
import { DeleteRequestForm } from "./form";

export const dynamic = "force-dynamic";

export default async function Page() {
  const session = await requirePageRole(["parent"]);
  const learners = listLearnersForParent(session.userId, session.tenantId);
  const requests = listDataDeletionRequestsForUser(session.userId, session.tenantId);

  return (
    <AppShell
      role="parent"
      roleLabel="Parent"
      navItems={PARENT_NAV}
      user={{ displayName: session.displayName, email: session.email }}
    >
      <PageHeader
        eyebrow="Privacy"
        title="Delete data"
        description="Request deletion of your account, a specific learner, or just an uploaded IEP. We preserve a small audit trail required for compliance."
      />

      <Card className="p-[var(--aivo-density-card-pad)] border-l-4 border-l-amber-500">
        <p className="text-sm">
          <strong>Deletion is permanent.</strong> Once approved, learner progress, lesson history,
          and IEP files are removed. We keep the minimum legally required audit records (when the
          request was made, that consent was withdrawn) so the deletion itself can be proven later.
        </p>
      </Card>

      <Card className="mt-4 p-[var(--aivo-density-card-pad)]">
        <DeleteRequestForm
          learners={learners.map((l) => ({ id: l.id, displayName: l.displayName }))}
        />
      </Card>

      <Card className="mt-4 p-[var(--aivo-density-card-pad)]">
        <h2 className="font-display font-semibold">Past requests</h2>
        {requests.length === 0 ? (
          <p className="mt-2 text-sm text-aivo-ink-soft">No requests yet.</p>
        ) : (
          <table className="mt-3 w-full text-sm">
            <thead className="text-left text-aivo-muted">
              <tr>
                <th className="py-2">Requested</th>
                <th className="py-2">Scope</th>
                <th className="py-2">Target</th>
                <th className="py-2">Status</th>
              </tr>
            </thead>
            <tbody>
              {requests.map((r) => (
                <tr key={r.id} className="border-t border-aivo-border">
                  <td className="py-2">{new Date(r.requestedAt).toLocaleString()}</td>
                  <td className="py-2">{r.scope}</td>
                  <td className="py-2">
                    {r.learnerId
                      ? (learners.find((l) => l.id === r.learnerId)?.displayName ?? r.learnerId)
                      : "Whole account"}
                  </td>
                  <td className="py-2">
                    <Badge
                      tone={
                        r.status === "completed"
                          ? "success"
                          : r.status === "denied"
                            ? "danger"
                            : "warning"
                      }
                    >
                      {r.status}
                    </Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </AppShell>
  );
}
