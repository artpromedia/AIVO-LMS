import { redirect } from "next/navigation";
import { requirePageRole } from "@aivo/admin-auth";
import {
  type RetentionDisposition,
  listRetentionPolicies,
  setRetentionPolicy,
} from "@aivo/admin-api/retention";
import { AdminCard, AdminPageFrame } from "@aivo/admin-ui";
import { formatDateTime } from "@/components/admin-format";
import { actionError } from "@/lib/action-errors";

const RETENTION_ROLES = ["platform_admin"] as const;

async function saveAction(formData: FormData) {
  "use server";
  const session = await requirePageRole([...RETENTION_ROLES]);
  const dataClass = String(formData.get("dataClass") || "");
  if (!dataClass) redirect("/platform/compliance/retention?error=Missing%20data%20class.");

  const rawDays = String(formData.get("retentionDays") || "").trim();
  const retentionDays = rawDays === "" ? null : Number(rawDays);
  if (retentionDays !== null && (!Number.isFinite(retentionDays) || retentionDays < 0)) {
    redirect("/platform/compliance/retention?error=Retention%20days%20must%20be%20a%20positive%20number.");
  }
  const disposition = String(formData.get("disposition") || "purge") as RetentionDisposition;
  const legalHold = String(formData.get("legalHold") || "") === "on";

  try {
    await setRetentionPolicy(session, dataClass, { retentionDays, disposition, legalHold });
  } catch (error) {
    redirect(`/platform/compliance/retention?error=${encodeURIComponent(actionError(error, "Policy update failed."))}`);
  }
  redirect(`/platform/compliance/retention?notice=${encodeURIComponent(`${dataClass} policy saved.`)}`);
}

export default async function RetentionPage({
  searchParams,
}: {
  searchParams: Promise<{ notice?: string; error?: string }>;
}) {
  const session = await requirePageRole([...RETENTION_ROLES]);
  const params = await searchParams;
  const policies = await listRetentionPolicies(session);

  return (
    <AdminPageFrame
      title="Data retention"
      description="Per-data-class retention windows and disposition, persisted in data-governance-svc. Blank retention = retain indefinitely (legal hold)."
    >
      {params.notice ? <p className="admin-notice mt-8">{params.notice}</p> : null}
      {params.error ? <p className="admin-error mt-8">{params.error}</p> : null}

      <AdminCard className="mt-6 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Data class</th>
                <th>Retention (days)</th>
                <th>Disposition</th>
                <th>Legal hold</th>
                <th>Updated</th>
                <th>Save</th>
              </tr>
            </thead>
            <tbody>
              {policies.map((policy) => (
                <tr key={policy.dataClass}>
                  <td className="font-bold">{policy.dataClass}</td>
                  <td colSpan={5}>
                    <form action={saveAction} className="flex flex-wrap items-center gap-3">
                      <input name="dataClass" type="hidden" value={policy.dataClass} />
                      <input
                        className="admin-input w-28"
                        name="retentionDays"
                        placeholder="∞"
                        type="number"
                        min="0"
                        defaultValue={policy.retentionDays ?? ""}
                      />
                      <select
                        className="admin-input"
                        name="disposition"
                        defaultValue={policy.disposition}
                      >
                        <option value="purge">purge</option>
                        <option value="anonymize">anonymize</option>
                      </select>
                      <label className="flex items-center gap-2 text-sm">
                        <input name="legalHold" type="checkbox" defaultChecked={policy.legalHold} />
                        Legal hold
                      </label>
                      <span className="text-sm text-slate-500 tabular-nums">
                        {formatDateTime(policy.updatedAt)}
                      </span>
                      <button className="admin-action" type="submit">
                        Save
                      </button>
                    </form>
                  </td>
                </tr>
              ))}
              {policies.length === 0 ? (
                <tr>
                  <td className="py-10 text-center text-slate-500" colSpan={6}>
                    No data classes configured.
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
