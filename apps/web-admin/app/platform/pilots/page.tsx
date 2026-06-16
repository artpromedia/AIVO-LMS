import Link from "next/link";
import { requirePageRole } from "@aivo/admin-auth";
import { AdminApiError } from "@aivo/admin-api";
import { listPilots, type PilotStatus } from "@aivo/admin-api/billing";
import { AdminCard, AdminPageFrame } from "@aivo/admin-ui";
import { StatusPill } from "@/components/status-pill";

function seatsLabel(p: PilotStatus): string {
  if (p.seatLimit == null) return `${p.seatsUsed} (uncapped)`;
  return `${p.seatsUsed} / ${p.seatLimit}`;
}

export default async function PilotsPage() {
  const session = await requirePageRole(["platform_admin"]);

  let pilots: PilotStatus[] = [];
  let loadError: string | null = null;
  try {
    pilots = await listPilots(session);
  } catch (error) {
    loadError = error instanceof AdminApiError ? error.message : "Could not load pilots.";
  }

  return (
    <AdminPageFrame
      title="District pilots"
      description="Live seat usage, parent/learner onboarding, coupon uptake, and expiry for every active district pilot."
      action={
        <Link className="admin-button" href="/platform/pilots/new">
          Provision pilot
        </Link>
      }
    >
      {loadError ? (
        <p className="mt-8 rounded-xl border border-red-200 bg-red-50 p-4 font-semibold text-red-800">
          {loadError}
        </p>
      ) : pilots.length === 0 ? (
        <AdminCard className="mt-8 p-6">
          <p className="text-slate-500">
            No active pilots yet. Provision one to get started — it will appear here with live seat
            and uptake numbers.
          </p>
        </AdminCard>
      ) : (
        <AdminCard className="mt-8 p-6">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500">
                  <th className="py-2">District</th>
                  <th className="py-2">Seats used</th>
                  <th className="py-2">Parents</th>
                  <th className="py-2">Therapists</th>
                  <th className="py-2">Learners</th>
                  <th className="py-2">Coupon ×</th>
                  <th className="py-2">Expires</th>
                  <th className="py-2">Status</th>
                </tr>
              </thead>
              <tbody>
                {pilots.map((p) => (
                  <tr key={p.tenantId} className="border-b border-slate-100">
                    <td className="py-3 font-semibold">
                      <Link
                        className="text-violet-700 hover:underline"
                        href={`/platform/pilots/${p.tenantId}`}
                      >
                        {p.districtName ?? p.tenantId}
                      </Link>
                    </td>
                    <td className="py-3 tabular-nums">{seatsLabel(p)}</td>
                    <td className="py-3 tabular-nums">{p.parentsOnboarded}</td>
                    <td className="py-3 tabular-nums">{p.therapistsOnboarded}</td>
                    <td className="py-3 tabular-nums">{p.learnersCreated}</td>
                    <td className="py-3 tabular-nums">{p.redemptions}</td>
                    <td className="py-3 tabular-nums">
                      {p.expiresAt ? new Date(p.expiresAt).toLocaleDateString() : "—"}
                    </td>
                    <td className="py-3">
                      <StatusPill status={p.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </AdminCard>
      )}
    </AdminPageFrame>
  );
}
