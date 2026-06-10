import Link from "next/link";
import { requirePageRole } from "@aivo/admin-auth";
import { getTrialConversion } from "@aivo/admin-api/billing";
import { AdminCard, AdminKpiCard, AdminPageFrame } from "@aivo/admin-ui";

function pct(value: number): string {
  return `${Math.round(value * 100)}%`;
}

export default async function TrialsReportPage() {
  const session = await requirePageRole(["platform_admin"]);
  const report = await getTrialConversion(session);

  return (
    <AdminPageFrame
      eyebrow="Platform billing"
      title="Trials & pilot conversion"
      description="Trial volume, upcoming trial ends, and trial-to-paid / pilot-coupon conversion. Pilots are subscriptions created from a coupon."
      action={
        <Link className="admin-button admin-button-secondary" href="/platform/billing/coupons">
          Coupons
        </Link>
      }
    >
      <section className="mt-8 grid gap-4 md:grid-cols-4">
        <AdminKpiCard label="Trials started (30d)" value={report.trialsStartedLast30d} />
        <AdminKpiCard label="Trialing now" value={report.trialingNow} />
        <AdminKpiCard label="Trials ending in 7 days" value={report.trialsEndingIn7d} />
        <AdminKpiCard label="Converted to paid (30d)" value={report.convertedLast30d} />
      </section>

      <section className="mt-6 grid gap-4 md:grid-cols-2">
        <AdminCard className="p-6">
          <p className="text-sm font-semibold text-slate-500">Trial → paid conversion (30d)</p>
          <p className="mt-2 text-3xl font-black">{pct(report.conversionRateLast30d)}</p>
          <p className="mt-2 text-sm text-slate-600">
            {report.convertedLast30d} of {report.trialsStartedLast30d} trials started in the last 30
            days are now paying.
          </p>
        </AdminCard>

        <AdminCard className="p-6">
          <p className="text-sm font-semibold text-slate-500">Pilot-coupon conversion</p>
          <p className="mt-2 text-3xl font-black">{pct(report.pilotConversionRate)}</p>
          <p className="mt-2 text-sm text-slate-600">
            {report.pilotsConverted} of {report.pilotsStarted} pilot subscriptions (created from a
            coupon) are active.
          </p>
        </AdminCard>
      </section>
    </AdminPageFrame>
  );
}
