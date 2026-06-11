import Link from "next/link";
import { redirect } from "next/navigation";
import { requirePageRole } from "@aivo/admin-auth";
import {
  type IncidentSeverity,
  type IncidentStatus,
  INCIDENT_SEVERITIES,
  INCIDENT_STATUSES,
  createSecurityIncident,
  listSecurityIncidents,
  updateSecurityIncident,
} from "@aivo/admin-api/security";
import { AdminCard, AdminKpiCard, AdminPageFrame } from "@aivo/admin-ui";
import { formatDateTime } from "@/components/admin-format";
import { actionError } from "@/lib/action-errors";

async function createAction(formData: FormData) {
  "use server";
  const session = await requirePageRole(["platform_admin"]);
  const title = String(formData.get("title") || "").trim();
  if (!title) redirect("/platform/security/incidents?error=Title%20is%20required.");
  const severity = String(formData.get("severity") || "sev3") as IncidentSeverity;
  const customerImpact = String(formData.get("customerImpact") || "") === "on";
  const regulatorNotificationRequired = String(formData.get("regulator") || "") === "on";
  try {
    await createSecurityIncident(session, {
      title,
      severity,
      customerImpact,
      regulatorNotificationRequired,
    });
  } catch (error) {
    redirect(`/platform/security/incidents?error=${encodeURIComponent(actionError(error, "Incident action failed."))}`);
  }
  redirect("/platform/security/incidents?notice=Incident%20opened.");
}

async function statusAction(formData: FormData) {
  "use server";
  const session = await requirePageRole(["platform_admin"]);
  const id = String(formData.get("id") || "");
  const status = String(formData.get("status") || "") as IncidentStatus;
  if (!id || !INCIDENT_STATUSES.includes(status)) {
    redirect("/platform/security/incidents?error=Missing%20incident%20or%20status.");
  }
  try {
    await updateSecurityIncident(session, id, { status });
  } catch (error) {
    redirect(`/platform/security/incidents?error=${encodeURIComponent(actionError(error, "Incident action failed."))}`);
  }
  redirect("/platform/security/incidents?notice=Incident%20updated.");
}

const SEVERITY_TONE: Record<IncidentSeverity, string> = {
  sev1: "text-red-700",
  sev2: "text-amber-700",
  sev3: "text-blue-700",
  sev4: "text-slate-500",
};

const OPEN_STATUSES: IncidentStatus[] = ["open", "investigating", "mitigating"];

export default async function SecurityIncidentsPage({
  searchParams,
}: {
  searchParams: Promise<{ notice?: string; error?: string }>;
}) {
  const session = await requirePageRole(["platform_admin"]);
  const params = await searchParams;
  const incidents = await listSecurityIncidents(session);

  const open = incidents.filter((i) => OPEN_STATUSES.includes(i.status)).length;
  const sev1 = incidents.filter((i) => i.severity === "sev1" && OPEN_STATUSES.includes(i.status)).length;

  return (
    <AdminPageFrame
      eyebrow="Platform · Security"
      title="Incidents"
      description="Security incident register and bridge ownership, persisted in admin-svc (Postgres)."
      action={
        <Link className="admin-button admin-button-secondary" href="/platform/security">
          Security overview
        </Link>
      }
    >
      {params.notice ? <p className="admin-notice mt-8">{params.notice}</p> : null}
      {params.error ? <p className="admin-error mt-8">{params.error}</p> : null}

      <section className="mt-8 grid gap-4 md:grid-cols-3">
        <AdminKpiCard label="Total" value={incidents.length} />
        <AdminKpiCard label="Open" value={open} />
        <AdminKpiCard label="Open SEV1" value={sev1} />
      </section>

      <AdminCard className="mt-6 p-6">
        <h2 className="text-lg font-black">Open incident</h2>
        <form action={createAction} className="mt-4 flex flex-wrap items-end gap-3">
          <input className="admin-input flex-1" name="title" placeholder="Title" required />
          <select className="admin-input" name="severity" defaultValue="sev3">
            {INCIDENT_SEVERITIES.map((severity) => (
              <option key={severity} value={severity}>
                {severity}
              </option>
            ))}
          </select>
          <label className="flex items-center gap-2 text-sm">
            <input name="customerImpact" type="checkbox" /> Customer impact
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input name="regulator" type="checkbox" /> Regulator notice
          </label>
          <button className="admin-button" type="submit">
            Open
          </button>
        </form>
      </AdminCard>

      <AdminCard className="mt-6 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Incident</th>
                <th>Severity</th>
                <th>Status</th>
                <th>Impact</th>
                <th>Detected</th>
                <th>Set status</th>
              </tr>
            </thead>
            <tbody>
              {incidents.map((incident) => (
                <tr key={incident.id}>
                  <td className="font-bold">{incident.title}</td>
                  <td className={`font-bold uppercase ${SEVERITY_TONE[incident.severity]}`}>
                    {incident.severity}
                  </td>
                  <td>
                    <span className="admin-status">{incident.status.replace("_", " ")}</span>
                  </td>
                  <td className="text-sm">
                    {incident.customerImpact ? "customer" : "—"}
                    {incident.regulatorNotificationRequired ? (
                      <span className="block text-amber-700">regulator notice</span>
                    ) : null}
                  </td>
                  <td className="text-sm">{formatDateTime(incident.detectedAt)}</td>
                  <td>
                    <form action={statusAction} className="flex items-center gap-2">
                      <input name="id" type="hidden" value={incident.id} />
                      <select className="admin-input" name="status" defaultValue={incident.status}>
                        {INCIDENT_STATUSES.map((status) => (
                          <option key={status} value={status}>
                            {status}
                          </option>
                        ))}
                      </select>
                      <button className="admin-action" type="submit">
                        Save
                      </button>
                    </form>
                  </td>
                </tr>
              ))}
              {incidents.length === 0 ? (
                <tr>
                  <td className="py-10 text-center text-slate-500" colSpan={6}>
                    No incidents recorded.
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
