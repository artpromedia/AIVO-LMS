import Link from "next/link";
import { redirect } from "next/navigation";
import { requirePageRole } from "@aivo/admin-auth";
import {
  type AiIncidentSeverity,
  type AiIncidentState,
  AI_INCIDENT_SEVERITIES,
  AI_INCIDENT_STATES,
  createAiIncident,
  listAiIncidents,
  updateAiIncidentState,
} from "@aivo/admin-api/ai-governance";
import { AdminCard, AdminKpiCard, AdminPageFrame } from "@aivo/admin-ui";
import { formatDateTime } from "@/components/admin-format";
import { StatusPill, type StatusTone } from "@/components/status-pill";
import { actionError } from "@/lib/action-errors";

async function createAction(formData: FormData) {
  "use server";
  const session = await requirePageRole(["platform_admin"]);
  const title = String(formData.get("title") || "").trim();
  const description = String(formData.get("description") || "").trim();
  if (!title || !description) {
    redirect("/platform/ai/incidents?error=Title%20and%20description%20are%20required.");
  }
  const severity = String(formData.get("severity") || "sev3") as AiIncidentSeverity;
  const modelId = String(formData.get("modelId") || "").trim() || null;
  const tenantId = String(formData.get("tenantId") || "").trim() || null;
  try {
    await createAiIncident(session, { title, description, severity, modelId, tenantId });
  } catch (error) {
    redirect(`/platform/ai/incidents?error=${encodeURIComponent(actionError(error, "Incident action failed."))}`);
  }
  redirect("/platform/ai/incidents?notice=Incident%20filed.");
}

async function stateAction(formData: FormData) {
  "use server";
  const session = await requirePageRole(["platform_admin"]);
  const id = String(formData.get("id") || "");
  const state = String(formData.get("state") || "") as AiIncidentState;
  if (!id || !AI_INCIDENT_STATES.includes(state)) {
    redirect("/platform/ai/incidents?error=Missing%20incident%20or%20state.");
  }
  const note = String(formData.get("note") || "").trim() || undefined;
  try {
    await updateAiIncidentState(session, id, { state, note });
  } catch (error) {
    redirect(`/platform/ai/incidents?error=${encodeURIComponent(actionError(error, "Incident action failed."))}`);
  }
  redirect("/platform/ai/incidents?notice=Incident%20updated.");
}

const SEVERITY_TONE: Record<AiIncidentSeverity, StatusTone> = {
  sev1: "danger",
  sev2: "warning",
  sev3: "info",
  sev4: "neutral",
};

const OPEN_STATES: AiIncidentState[] = ["open", "investigating", "mitigated"];

export default async function AiIncidentsPage({
  searchParams,
}: {
  searchParams: Promise<{ notice?: string; error?: string }>;
}) {
  const session = await requirePageRole(["platform_admin"]);
  const params = await searchParams;
  const incidents = await listAiIncidents(session);

  const open = incidents.filter((i) => OPEN_STATES.includes(i.state)).length;
  const sev1 = incidents.filter(
    (i) => i.severity === "sev1" && OPEN_STATES.includes(i.state),
  ).length;

  return (
    <AdminPageFrame
      title="AI incidents"
      description="Responsible-AI incident register with severity, state transitions and timeline."
      action={
        <Link className="admin-button admin-button-secondary" href="/platform/ai/policies">
          Safety policies
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
        <h2 className="text-lg font-black">File incident</h2>
        <form action={createAction} className="mt-4 flex flex-wrap items-end gap-3">
          <input className="admin-input flex-1" name="title" placeholder="Title" required />
          <input
            className="admin-input flex-1"
            name="description"
            placeholder="Description"
            required
          />
          <select className="admin-input" name="severity" defaultValue="sev3">
            {AI_INCIDENT_SEVERITIES.map((severity) => (
              <option key={severity} value={severity}>
                {severity}
              </option>
            ))}
          </select>
          <input className="admin-input" name="modelId" placeholder="Model ID (optional)" />
          <input className="admin-input" name="tenantId" placeholder="Tenant ID (optional)" />
          <button className="admin-button" type="submit">
            File
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
                <th>State</th>
                <th>Model / tenant</th>
                <th>Filed</th>
                <th>Set state</th>
              </tr>
            </thead>
            <tbody>
              {incidents.map((incident) => (
                <tr key={incident.id}>
                  <td>
                    <span className="block font-bold">{incident.title}</span>
                    <span className="block max-w-sm truncate text-sm text-slate-500">
                      {incident.description}
                    </span>
                  </td>
                  <td>
                    <StatusPill
                      status={incident.severity}
                      tone={SEVERITY_TONE[incident.severity]}
                      label={incident.severity.toUpperCase()}
                    />
                  </td>
                  <td>
                    <StatusPill status={incident.state} />
                  </td>
                  <td className="text-sm">
                    {incident.modelId ?? "—"}
                    {incident.tenantId ? (
                      <span className="block text-slate-500">{incident.tenantId}</span>
                    ) : null}
                  </td>
                  <td className="text-sm tabular-nums">{formatDateTime(incident.createdAt)}</td>
                  <td>
                    <form action={stateAction} className="flex items-center gap-2">
                      <input name="id" type="hidden" value={incident.id} />
                      <select className="admin-input" name="state" defaultValue={incident.state}>
                        {AI_INCIDENT_STATES.map((state) => (
                          <option key={state} value={state}>
                            {state}
                          </option>
                        ))}
                      </select>
                      <input className="admin-input" name="note" placeholder="Note" />
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
