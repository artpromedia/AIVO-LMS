import type {
  AdminAuditEntry,
  AdminBillingAccount,
  AdminLearnerSummary,
  AdminTenantSummary,
  AdminUserSummary,
} from "@aivo/admin-api/types";
import type {
  AdminComplianceControl,
  AdminControlStatus,
  AdminEvidenceBundle,
} from "@aivo/admin-api/compliance";
import { AdminCard, AdminMetricCard } from "@aivo/admin-ui";
import type { TrialConversionReport } from "@aivo/admin-api/billing";
import { formatBytes, formatDate, formatDateTime, formatPercent } from "@/components/admin-format";

function EmptyRow({ colSpan, label }: { colSpan: number; label: string }) {
  return (
    <tr>
      <td className="py-10 text-center text-slate-500" colSpan={colSpan}>
        {label}
      </td>
    </tr>
  );
}

export function AuditLogTable({ entries }: { entries: AdminAuditEntry[] }) {
  return (
    <AdminCard className="mt-6 overflow-hidden">
      <div className="overflow-x-auto">
        <table className="admin-table">
          <thead>
            <tr>
              <th>When</th>
              <th>Action</th>
              <th>Actor</th>
              <th>Resource</th>
              <th>Tenant</th>
            </tr>
          </thead>
          <tbody>
            {entries.map((entry) => (
              <tr key={entry.id}>
                <td className="text-sm">{formatDateTime(entry.createdAt)}</td>
                <td className="font-bold">{entry.action}</td>
                <td>
                  <span className="block">{entry.actorEmail || entry.actorId || "—"}</span>
                  <span className="text-sm font-normal text-slate-500">{entry.actorRoleLabel}</span>
                </td>
                <td className="text-sm">
                  {entry.resourceType}
                  {entry.resourceId ? <span className="text-slate-500"> · {entry.resourceId}</span> : null}
                </td>
                <td className="text-sm">{entry.tenantId ?? "—"}</td>
              </tr>
            ))}
            {entries.length === 0 ? <EmptyRow colSpan={5} label="No audit activity recorded yet." /> : null}
          </tbody>
        </table>
      </div>
    </AdminCard>
  );
}

export function TrialMetrics({ report }: { report: TrialConversionReport }) {
  return (
    <section className="mt-8 grid gap-4 md:grid-cols-4">
      <AdminMetricCard label="Trials started (30d)" value={report.trialsStartedLast30d} />
      <AdminMetricCard label="Trialing now" value={report.trialingNow} />
      <AdminMetricCard label="Ending in 7d" value={report.trialsEndingIn7d} />
      <AdminCard className="p-5">
        <p className="text-sm font-semibold text-slate-500">Conversion (30d)</p>
        <p className="mt-2 text-3xl font-black">{formatPercent(report.conversionRateLast30d)}</p>
        <p className="mt-1 text-sm text-slate-500">{report.convertedLast30d} converted</p>
      </AdminCard>
    </section>
  );
}

export function BillingAccountsTable({ accounts }: { accounts: AdminBillingAccount[] }) {
  return (
    <AdminCard className="mt-6 overflow-hidden">
      <div className="overflow-x-auto">
        <table className="admin-table">
          <thead>
            <tr>
              <th>Tenant</th>
              <th>Type</th>
              <th>Plan</th>
              <th>Status</th>
              <th>Payment</th>
              <th>Period ends</th>
              <th>Created</th>
            </tr>
          </thead>
          <tbody>
            {accounts.map((account) => (
              <tr key={account.id}>
                <td className="font-bold">{account.tenantName ?? account.tenantId}</td>
                <td>{account.tenantTypeLabel}</td>
                <td>{account.plan}</td>
                <td>
                  <span className="admin-status">{account.status}</span>
                </td>
                <td className="text-sm">{account.paymentStatus ?? "—"}</td>
                <td className="text-sm">{formatDate(account.currentPeriodEnd)}</td>
                <td className="text-sm">{formatDate(account.createdAt)}</td>
              </tr>
            ))}
            {accounts.length === 0 ? <EmptyRow colSpan={7} label="No billing accounts found." /> : null}
          </tbody>
        </table>
      </div>
    </AdminCard>
  );
}

const CONTROL_TONE: Record<AdminControlStatus, string> = {
  pass: "text-emerald-700",
  warn: "text-amber-700",
  fail: "text-red-700",
  unknown: "text-slate-500",
};

export function ComplianceControlsTable({ controls }: { controls: AdminComplianceControl[] }) {
  return (
    <AdminCard className="mt-6 overflow-hidden">
      <div className="overflow-x-auto">
        <table className="admin-table">
          <thead>
            <tr>
              <th>Control</th>
              <th>Category</th>
              <th>Status</th>
              <th>Evidence</th>
              <th>Last checked</th>
            </tr>
          </thead>
          <tbody>
            {controls.map((control) => (
              <tr key={control.id}>
                <td className="font-bold">{control.label}</td>
                <td>{control.category}</td>
                <td className={`font-bold uppercase ${CONTROL_TONE[control.status]}`}>{control.status}</td>
                <td className="text-sm">
                  {control.runbook ? (
                    <a className="font-semibold text-blue-700" href={control.runbook}>
                      {control.evidence || "Runbook"}
                    </a>
                  ) : (
                    control.evidence || "—"
                  )}
                </td>
                <td className="text-sm">{formatDateTime(control.lastCheckedAt)}</td>
              </tr>
            ))}
            {controls.length === 0 ? <EmptyRow colSpan={5} label="No compliance controls configured." /> : null}
          </tbody>
        </table>
      </div>
    </AdminCard>
  );
}

export function EvidenceBundlesTable({ bundles }: { bundles: AdminEvidenceBundle[] }) {
  return (
    <AdminCard className="mt-6 overflow-hidden">
      <div className="overflow-x-auto">
        <table className="admin-table">
          <thead>
            <tr>
              <th>Bundle date</th>
              <th>Filename</th>
              <th>Size</th>
              <th>SHA-256</th>
              <th>Generated</th>
            </tr>
          </thead>
          <tbody>
            {bundles.map((bundle) => (
              <tr key={bundle.id}>
                <td>{bundle.bundleDate || "—"}</td>
                <td className="font-bold">{bundle.filename}</td>
                <td className="text-sm">{formatBytes(bundle.sizeBytes)}</td>
                <td className="font-mono text-xs text-slate-500">{bundle.sha256.slice(0, 16)}…</td>
                <td className="text-sm">{formatDateTime(bundle.generatedAt)}</td>
              </tr>
            ))}
            {bundles.length === 0 ? <EmptyRow colSpan={5} label="No evidence bundles generated yet." /> : null}
          </tbody>
        </table>
      </div>
    </AdminCard>
  );
}

export function LearnersTable({ learners }: { learners: AdminLearnerSummary[] }) {
  return (
    <AdminCard className="mt-6 overflow-hidden">
      <div className="overflow-x-auto">
        <table className="admin-table">
          <thead>
            <tr>
              <th>Learner</th>
              <th>Grade</th>
              <th>Functioning level</th>
              <th>Tenant</th>
              <th>Created</th>
            </tr>
          </thead>
          <tbody>
            {learners.map((learner) => (
              <tr key={learner.id}>
                <td className="font-bold">{learner.name}</td>
                <td>{learner.gradeLevel ?? "—"}</td>
                <td className="text-sm">{learner.functioningLevel ?? "—"}</td>
                <td className="text-sm">{learner.tenantId ?? "—"}</td>
                <td className="text-sm">{formatDate(learner.createdAt)}</td>
              </tr>
            ))}
            {learners.length === 0 ? <EmptyRow colSpan={5} label="No learners found." /> : null}
          </tbody>
        </table>
      </div>
    </AdminCard>
  );
}

export function TenantsTable({ tenants }: { tenants: AdminTenantSummary[] }) {
  return (
    <AdminCard className="mt-6 overflow-hidden">
      <div className="overflow-x-auto">
        <table className="admin-table">
          <thead>
            <tr>
              <th>Tenant</th>
              <th>Type</th>
              <th>Status</th>
              <th>Created</th>
            </tr>
          </thead>
          <tbody>
            {tenants.map((tenant) => (
              <tr key={tenant.id}>
                <td className="font-bold">
                  <a className="text-blue-700" href={`/platform/tenants/${tenant.id}`}>
                    {tenant.name}
                  </a>
                </td>
                <td>{tenant.typeLabel}</td>
                <td className="text-sm">{tenant.status ?? "—"}</td>
                <td className="text-sm">{formatDate(tenant.createdAt)}</td>
              </tr>
            ))}
            {tenants.length === 0 ? <EmptyRow colSpan={4} label="No tenants found." /> : null}
          </tbody>
        </table>
      </div>
    </AdminCard>
  );
}

export function UsersTable({ users }: { users: AdminUserSummary[] }) {
  return (
    <AdminCard className="mt-6 overflow-hidden">
      <div className="overflow-x-auto">
        <table className="admin-table">
          <thead>
            <tr>
              <th>User</th>
              <th>Role</th>
              <th>Tenant</th>
              <th>Last login</th>
              <th>Created</th>
            </tr>
          </thead>
          <tbody>
            {users.map((user) => (
              <tr key={user.id}>
                <td className="font-bold">
                  <a className="text-blue-700" href={`/platform/users/${user.id}`}>
                    {user.name}
                  </a>
                  <span className="block text-sm font-normal text-slate-500">{user.email ?? "—"}</span>
                </td>
                <td>{user.roleLabel}</td>
                <td className="text-sm">{user.tenantId ?? "—"}</td>
                <td className="text-sm">{formatDateTime(user.lastLoginAt)}</td>
                <td className="text-sm">{formatDate(user.createdAt)}</td>
              </tr>
            ))}
            {users.length === 0 ? <EmptyRow colSpan={5} label="No users found." /> : null}
          </tbody>
        </table>
      </div>
    </AdminCard>
  );
}
