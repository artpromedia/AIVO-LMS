import Link from "next/link";
import { requirePlatformPage } from "@aivo/admin-auth";
import {
  type SecurityControlStatus,
  listSecurityControls,
} from "@aivo/admin-api/security";
import { AdminCard, AdminKpiCard, AdminPageFrame } from "@aivo/admin-ui";

export default async function SecurityPage() {
  const session = await requirePlatformPage("platform:read");
  const controls = await listSecurityControls(session);

  const count = (status: SecurityControlStatus) =>
    controls.filter((control) => control.status === status).length;
  const implemented = count("implemented");
  const coverage = controls.length === 0 ? 0 : Math.round((implemented / controls.length) * 100);

  return (
    <AdminPageFrame
      title="Security posture"
      description="SOC 2 / Trust Services control coverage, backed by admin-svc (Postgres)."
      action={
        <div className="flex flex-wrap gap-2">
          <Link className="admin-button" href="/platform/security/controls">
            Control register
          </Link>
          <Link className="admin-button admin-button-secondary" href="/platform/security/incidents">
            Incidents
          </Link>
          <Link className="admin-button admin-button-secondary" href="/platform/security/risks">
            Risk register
          </Link>
          <Link className="admin-button admin-button-secondary" href="/platform/security/vendors">
            Vendors
          </Link>
          <Link
            className="admin-button admin-button-secondary"
            href="/platform/security/vulnerabilities"
          >
            Vulnerabilities
          </Link>
        </div>
      }
    >
      <section className="mt-8 grid gap-4 md:grid-cols-4">
        <AdminKpiCard label="Controls" value={controls.length} />
        <AdminKpiCard label="Implemented" value={implemented} />
        <AdminKpiCard label="Partial" value={count("partial")} />
        <AdminKpiCard label="Not started" value={count("not_started")} />
      </section>

      <AdminCard className="mt-6 p-6">
        <p className="text-sm font-semibold text-slate-500">Implemented coverage</p>
        <p className="mt-2 text-4xl font-black">{coverage}%</p>
        <p className="mt-2 max-w-3xl text-slate-600">
          Manage the full control register — add controls, assign owners, and record implementation
          status — from the control register. Each change is hash-chained into the admin audit log.
        </p>
        <Link className="mt-4 inline-flex font-bold text-violet-700" href="/platform/security/controls">
          Open control register
        </Link>
      </AdminCard>
    </AdminPageFrame>
  );
}
