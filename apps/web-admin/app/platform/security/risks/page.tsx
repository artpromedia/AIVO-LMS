import Link from "next/link";
import { redirect } from "next/navigation";
import { requirePageRole } from "@aivo/admin-auth";
import { AdminApiError } from "@aivo/admin-api";
import {
  type RiskCategory,
  type RiskSeverity,
  type RiskTreatment,
  RISK_CATEGORIES,
  RISK_SEVERITIES,
  RISK_TREATMENTS,
  createSecurityRisk,
  listSecurityRisks,
  updateSecurityRisk,
} from "@aivo/admin-api/security";
import { AdminCard, AdminKpiCard, AdminPageFrame } from "@aivo/admin-ui";

function actionError(error: unknown): string {
  return error instanceof AdminApiError ? error.message : "Risk action failed.";
}

async function createAction(formData: FormData) {
  "use server";
  const session = await requirePageRole(["platform_admin"]);
  const title = String(formData.get("title") || "").trim();
  if (!title) redirect("/platform/security/risks?error=Title%20is%20required.");
  try {
    await createSecurityRisk(session, {
      title,
      category: String(formData.get("category") || "security") as RiskCategory,
      inherentSeverity: String(formData.get("inherentSeverity") || "medium") as RiskSeverity,
      residualSeverity: String(formData.get("residualSeverity") || "medium") as RiskSeverity,
      treatment: String(formData.get("treatment") || "mitigate") as RiskTreatment,
      owner: String(formData.get("owner") || "").trim(),
    });
  } catch (error) {
    redirect(`/platform/security/risks?error=${encodeURIComponent(actionError(error))}`);
  }
  redirect("/platform/security/risks?notice=Risk%20added.");
}

async function updateAction(formData: FormData) {
  "use server";
  const session = await requirePageRole(["platform_admin"]);
  const id = String(formData.get("id") || "");
  if (!id) redirect("/platform/security/risks?error=Missing%20risk.");
  try {
    await updateSecurityRisk(session, id, {
      treatment: String(formData.get("treatment") || "mitigate") as RiskTreatment,
      residualSeverity: String(formData.get("residualSeverity") || "medium") as RiskSeverity,
      open: String(formData.get("open") || "") === "open",
    });
  } catch (error) {
    redirect(`/platform/security/risks?error=${encodeURIComponent(actionError(error))}`);
  }
  redirect("/platform/security/risks?notice=Risk%20updated.");
}

const SEV_TONE: Record<RiskSeverity, string> = {
  low: "text-slate-500",
  medium: "text-blue-700",
  high: "text-amber-700",
  critical: "text-red-700",
};

export default async function SecurityRisksPage({
  searchParams,
}: {
  searchParams: Promise<{ notice?: string; error?: string }>;
}) {
  const session = await requirePageRole(["platform_admin"]);
  const params = await searchParams;
  const risks = await listSecurityRisks(session);
  const open = risks.filter((r) => r.open).length;

  return (
    <AdminPageFrame
      eyebrow="Platform · Security"
      title="Risk register"
      description="Enterprise risk register with inherent/residual severity and treatment, persisted in admin-svc (Postgres)."
      action={
        <Link className="admin-button admin-button-secondary" href="/platform/security">
          Security overview
        </Link>
      }
    >
      {params.notice ? <p className="admin-notice mt-8">{params.notice}</p> : null}
      {params.error ? <p className="admin-error mt-8">{params.error}</p> : null}

      <section className="mt-8 grid gap-4 md:grid-cols-2">
        <AdminKpiCard label="Risks" value={risks.length} />
        <AdminKpiCard label="Open" value={open} />
      </section>

      <AdminCard className="mt-6 p-6">
        <h2 className="text-lg font-black">Add risk</h2>
        <form action={createAction} className="mt-4 flex flex-wrap items-end gap-3">
          <input className="admin-input flex-1" name="title" placeholder="Title" required />
          <input className="admin-input w-40" name="owner" placeholder="Owner" />
          <select className="admin-input" name="category" defaultValue="security">
            {RISK_CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c.replace("_", " ")}
              </option>
            ))}
          </select>
          <select
            className="admin-input"
            name="inherentSeverity"
            defaultValue="medium"
            title="Inherent severity"
          >
            {RISK_SEVERITIES.map((s) => (
              <option key={s} value={s}>
                inherent: {s}
              </option>
            ))}
          </select>
          <select
            className="admin-input"
            name="residualSeverity"
            defaultValue="medium"
            title="Residual severity"
          >
            {RISK_SEVERITIES.map((s) => (
              <option key={s} value={s}>
                residual: {s}
              </option>
            ))}
          </select>
          <select className="admin-input" name="treatment" defaultValue="mitigate">
            {RISK_TREATMENTS.map((t) => (
              <option key={t} value={t}>
                {t}
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
                <th>Risk</th>
                <th>Category</th>
                <th>Inherent</th>
                <th>Residual</th>
                <th>Treatment</th>
                <th>State</th>
                <th>Update</th>
              </tr>
            </thead>
            <tbody>
              {risks.map((risk) => (
                <tr key={risk.id}>
                  <td className="font-bold">
                    {risk.title}
                    {risk.owner ? (
                      <span className="block text-sm font-normal text-slate-500">{risk.owner}</span>
                    ) : null}
                  </td>
                  <td className="text-sm">{risk.category.replace("_", " ")}</td>
                  <td className={`font-bold uppercase ${SEV_TONE[risk.inherentSeverity]}`}>
                    {risk.inherentSeverity}
                  </td>
                  <td className={`font-bold uppercase ${SEV_TONE[risk.residualSeverity]}`}>
                    {risk.residualSeverity}
                  </td>
                  <td className="text-sm">{risk.treatment}</td>
                  <td>
                    <span className="admin-status">{risk.open ? "open" : "closed"}</span>
                  </td>
                  <td>
                    <form action={updateAction} className="flex items-center gap-2">
                      <input name="id" type="hidden" value={risk.id} />
                      <select className="admin-input" name="treatment" defaultValue={risk.treatment}>
                        {RISK_TREATMENTS.map((t) => (
                          <option key={t} value={t}>
                            {t}
                          </option>
                        ))}
                      </select>
                      <select
                        className="admin-input"
                        name="residualSeverity"
                        defaultValue={risk.residualSeverity}
                      >
                        {RISK_SEVERITIES.map((s) => (
                          <option key={s} value={s}>
                            {s}
                          </option>
                        ))}
                      </select>
                      <select
                        className="admin-input"
                        name="open"
                        defaultValue={risk.open ? "open" : "closed"}
                      >
                        <option value="open">open</option>
                        <option value="closed">closed</option>
                      </select>
                      <button className="admin-action" type="submit">
                        Save
                      </button>
                    </form>
                  </td>
                </tr>
              ))}
              {risks.length === 0 ? (
                <tr>
                  <td className="py-10 text-center text-slate-500" colSpan={7}>
                    No risks in the register yet.
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
