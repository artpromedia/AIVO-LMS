import Link from "next/link";
import { notFound } from "next/navigation";
import { requirePageRole } from "@aivo/admin-auth";
import { AdminApiError } from "@aivo/admin-api";
import { getPilotStatus, type PilotStatus } from "@aivo/admin-api/billing";
import { AdminCard, AdminPageFrame } from "@aivo/admin-ui";

function StatCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <AdminCard className="p-5">
      <p className="text-sm font-semibold text-slate-500">{label}</p>
      <p className="mt-2 text-3xl font-black">{value}</p>
      {sub ? <p className="mt-1 text-sm text-slate-500">{sub}</p> : null}
    </AdminCard>
  );
}

export default async function PilotDetailPage({
  params,
}: {
  params: Promise<{ tenantId: string }>;
}) {
  const session = await requirePageRole(["platform_admin"]);
  const { tenantId } = await params;

  let pilot: PilotStatus;
  try {
    pilot = await getPilotStatus(session, tenantId);
  } catch (error) {
    if (error instanceof AdminApiError && error.status === 404) notFound();
    throw error;
  }
  if (pilot.status === "none") notFound();

  const seatsLabel =
    pilot.seatLimit == null ? "Uncapped" : `${pilot.seatsUsed} / ${pilot.seatLimit}`;
  const remaining = pilot.seatsRemaining == null ? "Unlimited" : String(pilot.seatsRemaining);
  const expiry = pilot.expiresAt ? new Date(pilot.expiresAt) : null;

  return (
    <AdminPageFrame
      eyebrow="Pilot operations"
      title={pilot.districtName ?? tenantId}
      description="Live entitlement, seat usage, onboarding, and coupon uptake for this district pilot."
      action={
        <Link className="admin-button admin-button-secondary" href="/platform/pilots">
          All pilots
        </Link>
      }
    >
      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Seats used" value={seatsLabel} sub={`${remaining} remaining`} />
        <StatCard label="Parents onboarded" value={String(pilot.parentsOnboarded)} />
        <StatCard label="Learners created" value={String(pilot.learnersCreated)} />
        <StatCard
          label="Status"
          value={pilot.status}
          sub={expiry ? `Expires ${expiry.toLocaleDateString()}` : undefined}
        />
      </div>

      <AdminCard className="mt-6 p-6">
        <h2 className="text-xl font-black">Entitlement</h2>
        <dl className="mt-4 grid gap-3 sm:grid-cols-2">
          <div className="flex justify-between rounded-xl bg-slate-50 px-4 py-3">
            <dt className="font-semibold text-slate-500">Plan</dt>
            <dd className="font-black">{pilot.plan ?? "—"}</dd>
          </div>
          <div className="flex justify-between rounded-xl bg-slate-50 px-4 py-3">
            <dt className="font-semibold text-slate-500">Licensing tier</dt>
            <dd className="font-black">{pilot.tier ?? "—"}</dd>
          </div>
          <div className="flex justify-between rounded-xl bg-slate-50 px-4 py-3">
            <dt className="font-semibold text-slate-500">Provisioning coupon</dt>
            <dd className="break-all font-black">{pilot.couponCode ?? "—"}</dd>
          </div>
          <div className="flex justify-between rounded-xl bg-slate-50 px-4 py-3">
            <dt className="font-semibold text-slate-500">Coupon redemptions</dt>
            <dd className="font-black">{pilot.redemptions}</dd>
          </div>
        </dl>
      </AdminCard>
    </AdminPageFrame>
  );
}
