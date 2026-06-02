import { requirePageRole } from "@/lib/auth/server";
import { getTranslations } from "next-intl/server";
import { AppShell } from "@/components/layout/app-shell";
import { PageHeader } from "@/components/layout/page-header";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { SCHOOL_NAV } from "@/components/layout/role-shells";
import {
  getActiveSubscriptionForTenant,
  getTenantById,
  listInvoicesForTenant,
  listSeatAssignments,
  listSeatLicensesForTenant,
} from "@/lib/db/repos";
import { getSchoolSeatView, listSeatRequestsForSchool } from "@/lib/billing/district-pool";
import { AssignSeatRow, RevokeSeatButton } from "./seat-actions";
import { DistrictSeatSection } from "./district-seat-section";

const STATUS_TONE: Record<string, "success" | "warning" | "danger" | "neutral"> = {
  trialing: "warning",
  active: "success",
  past_due: "danger",
  canceled: "neutral",
  paused: "warning",
};

export default async function Page() {
  const session = await requirePageRole(["school_admin"]);
  const t = await getTranslations("admin.school_billing");
  const tenant = getTenantById(session.tenantId);
  const sub = getActiveSubscriptionForTenant(session.tenantId);
  const licenses = listSeatLicensesForTenant(session.tenantId);
  const invoices = listInvoicesForTenant(session.tenantId);
  const seatView = getSchoolSeatView(session.tenantId);
  const seatRequests = listSeatRequestsForSchool(session.tenantId);

  return (
    <AppShell
      role="school_admin"
      roleLabel="School admin"
      navItems={SCHOOL_NAV}
      user={{ displayName: session.displayName, email: session.email }}
    >
      <PageHeader
        eyebrow="School admin"
        title={t("title")}
        description={`Plan, invoices, and seat assignments for ${tenant?.name ?? "this school"}.`}
      />

      {sub ? (
        <Card className="mb-6 p-[var(--aivo-density-card-pad)]">
          <div className="flex flex-wrap items-center gap-3">
            <div>
              <p className="font-display text-lg font-semibold">{sub.planId}</p>
              <p className="text-sm text-aivo-ink-soft">
                Period {new Date(sub.currentPeriodStartAt).toLocaleDateString()} –{" "}
                {new Date(sub.currentPeriodEndAt).toLocaleDateString()}
              </p>
            </div>
            <Badge tone={STATUS_TONE[sub.status] ?? "neutral"} className="ml-auto">
              {sub.status}
            </Badge>
          </div>
        </Card>
      ) : (
        <EmptyState
          title={t("no_subscription")}
          description="Contact platform billing to provision a school subscription."
        />
      )}

      <h2 className="mb-3 font-display text-lg font-semibold">{t("seat_licenses")}</h2>
      {licenses.length === 0 ? (
        <EmptyState title={t("no_seat_licenses")} />
      ) : (
        <div className="space-y-4">
          {licenses.map(({ license, assigned, remaining }) => {
            const assignments = listSeatAssignments(license.id).filter((a) => !a.revokedAt);
            return (
              <Card key={license.id} className="overflow-hidden">
                <div className="flex items-center justify-between p-4">
                  <div>
                    <p className="font-semibold">License {license.id.slice(0, 12)}</p>
                    <p className="text-sm text-aivo-ink-soft">
                      {assigned} of {license.totalSeats} seats assigned
                    </p>
                  </div>
                </div>
                <AssignSeatRow licenseId={license.id} remaining={remaining} />
                {assignments.length === 0 ? (
                  <p className="p-4 text-sm text-aivo-ink-soft">{t("no_seats_assigned")}</p>
                ) : (
                  <table className="w-full text-sm">
                    <thead className="bg-aivo-surface-2 text-left">
                      <tr>
                        <th className="p-3">{t("col_subject")}</th>
                        <th className="p-3">Kind</th>
                        <th className="p-3">{t("col_assigned")}</th>
                        <th className="p-3" />
                      </tr>
                    </thead>
                    <tbody>
                      {assignments.map((a) => (
                        <tr key={a.id} className="border-t border-aivo-border">
                          <td className="p-3 font-medium">{a.subjectId}</td>
                          <td className="p-3 text-aivo-ink-soft">{a.subjectKind}</td>
                          <td className="p-3 text-aivo-ink-soft">
                            {new Date(a.assignedAt).toLocaleDateString()}
                          </td>
                          <td className="p-3 text-right">
                            <RevokeSeatButton assignmentId={a.id} />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </Card>
            );
          })}
        </div>
      )}

      <h2 className="mb-3 mt-8 font-display text-lg font-semibold">{t("invoices")}</h2>
      {invoices.length === 0 ? (
        <EmptyState title={t("no_invoices")} />
      ) : (
        <Card className="overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-aivo-surface-2 text-left">
              <tr>
                <th className="p-3">{t("col_number")}</th>
                <th className="p-3">{t("col_period")}</th>
                <th className="p-3">{t("col_amount")}</th>
                <th className="p-3">{t("col_status")}</th>
              </tr>
            </thead>
            <tbody>
              {invoices.map((i) => (
                <tr key={i.id} className="border-t border-aivo-border">
                  <td className="p-3 font-medium">{i.number}</td>
                  <td className="p-3 text-aivo-ink-soft">
                    {new Date(i.periodStartAt).toLocaleDateString()} –{" "}
                    {new Date(i.periodEndAt).toLocaleDateString()}
                  </td>
                  <td className="p-3">${(i.amountCents / 100).toFixed(2)}</td>
                  <td className="p-3">
                    <Badge
                      tone={
                        i.status === "paid"
                          ? "success"
                          : i.status === "open"
                            ? "warning"
                            : "neutral"
                      }
                    >
                      {i.status}
                    </Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}

      {/* District seat allocation section */}
      <DistrictSeatSection
        districtId={seatView.districtId}
        allocated={seatView.allocated}
        used={seatView.used}
        requests={seatRequests.map((r) => ({
          id: r.id,
          requestedSeats: r.requestedSeats,
          justification: r.justification,
          status: r.status,
          createdAt: r.createdAt,
        }))}
      />
    </AppShell>
  );
}
