import Link from "next/link";
import type { PilotStatus } from "@aivo/admin-api/billing";
import { AdminCard } from "@aivo/admin-ui";

/**
 * Per-widget degraded state for the /platform dashboard. Every panel owns
 * its failure: a skeleton silhouette, the admin-svc failure description, and
 * a real retry (full re-request of the page). The grid keeps its shape, so
 * the page still reads as a dashboard when one source is down.
 */
export function PanelError({
  testId,
  title,
  message,
  compact = false,
}: {
  testId: string;
  title: string;
  message: string | null;
  compact?: boolean;
}) {
  return (
    <AdminCard className={compact ? "p-5" : "p-6"} testId={testId}>
      <h3 className={compact ? "text-sm font-semibold text-slate-500" : "admin-h2"}>{title}</h3>
      <div className="mt-3 space-y-2" aria-hidden="true">
        <div className="admin-skeleton h-3 w-3/4" />
        <div className="admin-skeleton h-3 w-1/2" />
        {compact ? null : <div className="admin-skeleton h-3 w-2/3" />}
      </div>
      <p className="admin-error mt-4 text-sm" data-testid={`${testId}-error`}>
        Couldn&apos;t load — {message ?? "the data source is unavailable"}
      </p>
      <a className="admin-button admin-button-secondary mt-3 text-sm" href="/platform">
        Retry
      </a>
    </AdminCard>
  );
}

const PILOT_STATUS_TONE: Record<PilotStatus["status"], string> = {
  active: "text-emerald-700",
  expired: "text-amber-700",
  none: "text-slate-500",
};

export function PilotsTablePanel({ pilots, testId }: { pilots: PilotStatus[]; testId: string }) {
  return (
    <AdminCard className="p-6" testId={testId}>
      <header className="flex items-end justify-between gap-4">
        <div>
          <h3 className="admin-h2">Active pilots</h3>
          <p className="mt-1 text-sm text-slate-600">
            Live seats, onboarding uptake, and expiry from billing-svc.
          </p>
        </div>
        <Link className="font-bold text-blue-700" href="/platform/pilots">
          Pilot operations
        </Link>
      </header>
      {pilots.length === 0 ? (
        <p className="mt-4 text-sm text-slate-600">No district pilots provisioned yet.</p>
      ) : (
        <div className="mt-4 overflow-x-auto">
          <table className="admin-table">
            <thead>
              <tr>
                <th>District</th>
                <th>Seats</th>
                <th>Parents</th>
                <th>Therapists</th>
                <th>Learners</th>
                <th>Expires</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {pilots.map((pilot) => {
                const pct =
                  pilot.seatLimit && pilot.seatLimit > 0
                    ? Math.min(100, Math.round((pilot.seatsUsed / pilot.seatLimit) * 100))
                    : 0;
                return (
                  <tr key={pilot.tenantId} data-testid="pilot-row">
                    <td className="font-semibold">
                      <Link className="text-blue-700" href={`/platform/pilots/${pilot.tenantId}`}>
                        {pilot.districtName ?? pilot.tenantId}
                      </Link>
                    </td>
                    <td className="admin-tabular">
                      <span>
                        {pilot.seatsUsed.toLocaleString("en-US")}
                        {pilot.seatLimit ? ` / ${pilot.seatLimit.toLocaleString("en-US")}` : ""}
                      </span>
                      <span
                        className="mt-1 block h-1.5 w-28 rounded-full"
                        style={{ background: "var(--admin-chart-grid)" }}
                        aria-hidden="true"
                      >
                        <span
                          className="block h-1.5 rounded-full"
                          style={{ width: `${pct}%`, background: "var(--admin-chart-1)" }}
                        />
                      </span>
                    </td>
                    <td className="admin-tabular">
                      {pilot.parentsOnboarded.toLocaleString("en-US")}
                    </td>
                    <td className="admin-tabular">
                      {pilot.therapistsOnboarded.toLocaleString("en-US")}
                    </td>
                    <td className="admin-tabular">
                      {pilot.learnersCreated.toLocaleString("en-US")}
                    </td>
                    <td>
                      {pilot.expiresAt
                        ? new Date(pilot.expiresAt).toLocaleDateString("en-US", {
                            month: "short",
                            day: "numeric",
                            year: "numeric",
                          })
                        : "—"}
                    </td>
                    <td>
                      <span className={`font-bold uppercase ${PILOT_STATUS_TONE[pilot.status]}`}>
                        {pilot.status}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </AdminCard>
  );
}
