import Link from "next/link";
import { redirect } from "next/navigation";
import { requirePageRole } from "@aivo/admin-auth";
import {
  type SecurityControlStatus,
  type SecurityCriterion,
  SECURITY_CONTROL_STATUSES,
  SECURITY_CRITERIA,
  createSecurityControl,
  listSecurityControls,
  updateSecurityControl,
} from "@aivo/admin-api/security";
import { AdminCard, AdminPageFrame } from "@aivo/admin-ui";
import { formatDateTime } from "@/components/admin-format";
import { actionError } from "@/lib/action-errors";

async function createAction(formData: FormData) {
  "use server";
  const session = await requirePageRole(["platform_admin"]);
  const code = String(formData.get("code") || "").trim();
  const title = String(formData.get("title") || "").trim();
  if (!code || !title) {
    redirect("/platform/security/controls?error=Code%20and%20title%20are%20required.");
  }
  const criterion = String(formData.get("criterion") || "security") as SecurityCriterion;
  const status = String(formData.get("status") || "not_started") as SecurityControlStatus;
  const owner = String(formData.get("owner") || "").trim();
  try {
    await createSecurityControl(session, { code, title, criterion, status, owner });
  } catch (error) {
    redirect(`/platform/security/controls?error=${encodeURIComponent(actionError(error, "Control action failed."))}`);
  }
  redirect(`/platform/security/controls?notice=${encodeURIComponent(`Control ${code} added.`)}`);
}

async function statusAction(formData: FormData) {
  "use server";
  const session = await requirePageRole(["platform_admin"]);
  const id = String(formData.get("id") || "");
  const status = String(formData.get("status") || "") as SecurityControlStatus;
  if (!id || !SECURITY_CONTROL_STATUSES.includes(status)) {
    redirect("/platform/security/controls?error=Missing%20control%20or%20status.");
  }
  try {
    await updateSecurityControl(session, id, { status });
  } catch (error) {
    redirect(`/platform/security/controls?error=${encodeURIComponent(actionError(error, "Control action failed."))}`);
  }
  redirect("/platform/security/controls?notice=Status%20updated.");
}

const STATUS_TONE: Record<SecurityControlStatus, string> = {
  implemented: "text-emerald-700",
  partial: "text-amber-700",
  not_started: "text-red-700",
  not_applicable: "text-slate-500",
};

export default async function SecurityControlsPage({
  searchParams,
}: {
  searchParams: Promise<{ notice?: string; error?: string }>;
}) {
  const session = await requirePageRole(["platform_admin"]);
  const params = await searchParams;
  const controls = await listSecurityControls(session);

  return (
    <AdminPageFrame
      eyebrow="Platform · Security"
      title="Control register"
      description="SOC 2 / Trust Services controls, persisted in admin-svc (Postgres)."
      action={
        <Link className="admin-button admin-button-secondary" href="/platform/security">
          Security overview
        </Link>
      }
    >
      {params.notice ? <p className="admin-notice mt-8">{params.notice}</p> : null}
      {params.error ? <p className="admin-error mt-8">{params.error}</p> : null}

      <AdminCard className="mt-6 p-6">
        <h2 className="text-lg font-black">Add control</h2>
        <form action={createAction} className="mt-4 flex flex-wrap items-end gap-3">
          <input className="admin-input w-28" name="code" placeholder="Code" required />
          <input className="admin-input flex-1" name="title" placeholder="Title" required />
          <input className="admin-input w-40" name="owner" placeholder="Owner" />
          <select className="admin-input" name="criterion" defaultValue="security">
            {SECURITY_CRITERIA.map((criterion) => (
              <option key={criterion} value={criterion}>
                {criterion}
              </option>
            ))}
          </select>
          <select className="admin-input" name="status" defaultValue="not_started">
            {SECURITY_CONTROL_STATUSES.map((status) => (
              <option key={status} value={status}>
                {status}
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
                <th>Code</th>
                <th>Control</th>
                <th>Criterion</th>
                <th>Owner</th>
                <th>Status</th>
                <th>Reviewed</th>
                <th>Set status</th>
              </tr>
            </thead>
            <tbody>
              {controls.map((control) => (
                <tr key={control.id}>
                  <td className="font-bold">{control.code}</td>
                  <td>
                    <span className="block font-bold">{control.title}</span>
                    {control.description ? (
                      <span className="text-sm font-normal text-slate-500">{control.description}</span>
                    ) : null}
                  </td>
                  <td className="text-sm">{control.criterion.replace("_", " ")}</td>
                  <td className="text-sm">{control.owner || "—"}</td>
                  <td className={`font-bold uppercase ${STATUS_TONE[control.status]}`}>
                    {control.status.replace("_", " ")}
                  </td>
                  <td className="text-sm">{formatDateTime(control.lastReviewedAt)}</td>
                  <td>
                    <form action={statusAction} className="flex items-center gap-2">
                      <input name="id" type="hidden" value={control.id} />
                      <select className="admin-input" name="status" defaultValue={control.status}>
                        {SECURITY_CONTROL_STATUSES.map((status) => (
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
              {controls.length === 0 ? (
                <tr>
                  <td className="py-10 text-center text-slate-500" colSpan={7}>
                    No controls in the register yet.
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
