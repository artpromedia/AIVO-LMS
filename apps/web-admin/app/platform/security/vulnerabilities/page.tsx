import Link from "next/link";
import { redirect } from "next/navigation";
import { requirePageRole } from "@aivo/admin-auth";
import { AdminApiError } from "@aivo/admin-api";
import {
  type VulnSeverity,
  type VulnSource,
  type VulnStatus,
  VULN_SEVERITIES,
  VULN_SOURCES,
  VULN_STATUSES,
  createSecurityVulnerability,
  listSecurityVulnerabilities,
  updateSecurityVulnerability,
} from "@aivo/admin-api/security";
import { AdminCard, AdminKpiCard, AdminPageFrame } from "@aivo/admin-ui";
import { formatDateTime } from "@/components/admin-format";

function actionError(error: unknown): string {
  return error instanceof AdminApiError ? error.message : "Vulnerability action failed.";
}

async function createAction(formData: FormData) {
  "use server";
  const session = await requirePageRole(["platform_admin"]);
  const title = String(formData.get("title") || "").trim();
  if (!title) redirect("/platform/security/vulnerabilities?error=Title%20is%20required.");
  const cveId = String(formData.get("cveId") || "").trim();
  try {
    await createSecurityVulnerability(session, {
      title,
      cveId: cveId || null,
      severity: String(formData.get("severity") || "medium") as VulnSeverity,
      source: String(formData.get("source") || "internal") as VulnSource,
      affectedComponent: String(formData.get("affectedComponent") || "").trim(),
    });
  } catch (error) {
    redirect(`/platform/security/vulnerabilities?error=${encodeURIComponent(actionError(error))}`);
  }
  redirect("/platform/security/vulnerabilities?notice=Finding%20added.");
}

async function statusAction(formData: FormData) {
  "use server";
  const session = await requirePageRole(["platform_admin"]);
  const id = String(formData.get("id") || "");
  const status = String(formData.get("status") || "") as VulnStatus;
  if (!id || !VULN_STATUSES.includes(status)) {
    redirect("/platform/security/vulnerabilities?error=Missing%20finding%20or%20status.");
  }
  const fixedIn = String(formData.get("fixedIn") || "").trim();
  try {
    await updateSecurityVulnerability(session, id, { status, fixedIn: fixedIn || null });
  } catch (error) {
    redirect(`/platform/security/vulnerabilities?error=${encodeURIComponent(actionError(error))}`);
  }
  redirect("/platform/security/vulnerabilities?notice=Finding%20updated.");
}

const SEV_TONE: Record<VulnSeverity, string> = {
  low: "text-slate-500",
  medium: "text-blue-700",
  high: "text-amber-700",
  critical: "text-red-700",
};

const OPEN_STATUSES: VulnStatus[] = ["open", "triaged"];

export default async function SecurityVulnerabilitiesPage({
  searchParams,
}: {
  searchParams: Promise<{ notice?: string; error?: string }>;
}) {
  const session = await requirePageRole(["platform_admin"]);
  const params = await searchParams;
  const findings = await listSecurityVulnerabilities(session);
  const open = findings.filter((f) => OPEN_STATUSES.includes(f.status)).length;
  const criticalOpen = findings.filter(
    (f) => f.severity === "critical" && OPEN_STATUSES.includes(f.status),
  ).length;

  return (
    <AdminPageFrame
      eyebrow="Platform · Security"
      title="Vulnerabilities"
      description="Vulnerability findings from scans, pen tests, and reports, persisted in admin-svc (Postgres)."
      action={
        <Link className="admin-button admin-button-secondary" href="/platform/security">
          Security overview
        </Link>
      }
    >
      {params.notice ? <p className="admin-notice mt-8">{params.notice}</p> : null}
      {params.error ? <p className="admin-error mt-8">{params.error}</p> : null}

      <section className="mt-8 grid gap-4 md:grid-cols-3">
        <AdminKpiCard label="Findings" value={findings.length} />
        <AdminKpiCard label="Open" value={open} />
        <AdminKpiCard label="Open critical" value={criticalOpen} />
      </section>

      <AdminCard className="mt-6 p-6">
        <h2 className="text-lg font-black">Add finding</h2>
        <form action={createAction} className="mt-4 flex flex-wrap items-end gap-3">
          <input className="admin-input flex-1" name="title" placeholder="Title" required />
          <input className="admin-input w-36" name="cveId" placeholder="CVE / finding id" />
          <input
            className="admin-input w-44"
            name="affectedComponent"
            placeholder="Affected component"
          />
          <select className="admin-input" name="severity" defaultValue="medium">
            {VULN_SEVERITIES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
          <select className="admin-input" name="source" defaultValue="internal">
            {VULN_SOURCES.map((s) => (
              <option key={s} value={s}>
                {s.replace("_", " ")}
              </option>
            ))}
          </select>
          <button className="admin-button" type="submit">
            Add
          </button>
        </form>
      </AdminCard>

      <AdminCard className="mt-6 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Finding</th>
                <th>CVE</th>
                <th>Severity</th>
                <th>Source</th>
                <th>Component</th>
                <th>Status</th>
                <th>Discovered</th>
                <th>Update</th>
              </tr>
            </thead>
            <tbody>
              {findings.map((finding) => (
                <tr key={finding.id}>
                  <td className="font-bold">{finding.title}</td>
                  <td className="font-mono text-xs">{finding.cveId ?? "—"}</td>
                  <td className={`font-bold uppercase ${SEV_TONE[finding.severity]}`}>
                    {finding.severity}
                  </td>
                  <td className="text-sm">{finding.source.replace("_", " ")}</td>
                  <td className="text-sm">{finding.affectedComponent || "—"}</td>
                  <td>
                    <span className="admin-status">{finding.status}</span>
                  </td>
                  <td className="text-sm">{formatDateTime(finding.discoveredAt)}</td>
                  <td>
                    <form action={statusAction} className="flex items-center gap-2">
                      <input name="id" type="hidden" value={finding.id} />
                      <select className="admin-input" name="status" defaultValue={finding.status}>
                        {VULN_STATUSES.map((s) => (
                          <option key={s} value={s}>
                            {s}
                          </option>
                        ))}
                      </select>
                      <input
                        className="admin-input w-28"
                        name="fixedIn"
                        placeholder="fixed in"
                        defaultValue={finding.fixedIn ?? ""}
                      />
                      <button className="admin-action" type="submit">
                        Save
                      </button>
                    </form>
                  </td>
                </tr>
              ))}
              {findings.length === 0 ? (
                <tr>
                  <td className="py-10 text-center text-slate-500" colSpan={8}>
                    No vulnerability findings recorded.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </AdminCard>
    </AdminPageFrame>
  );
}
