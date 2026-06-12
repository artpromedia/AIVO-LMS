import Link from "next/link";
import { revalidatePath } from "next/cache";
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
import {
  AddControlForm,
  ControlStatusForm,
  type ControlActionState,
} from "./controls-forms";

async function createAction(
  _prev: ControlActionState,
  formData: FormData,
): Promise<ControlActionState> {
  "use server";
  const session = await requirePageRole(["platform_admin"]);
  const code = String(formData.get("code") || "").trim();
  const title = String(formData.get("title") || "").trim();
  if (!code || !title) {
    return { error: "Code and title are required." };
  }
  const criterion = String(formData.get("criterion") || "security") as SecurityCriterion;
  const status = String(formData.get("status") || "not_started") as SecurityControlStatus;
  const owner = String(formData.get("owner") || "").trim();
  try {
    await createSecurityControl(session, { code, title, criterion, status, owner });
  } catch (error) {
    return { error: actionError(error, "Control action failed.") };
  }
  revalidatePath("/platform/security/controls");
  return { notice: `Control ${code} added.` };
}

async function statusAction(
  _prev: ControlActionState,
  formData: FormData,
): Promise<ControlActionState> {
  "use server";
  const session = await requirePageRole(["platform_admin"]);
  const id = String(formData.get("id") || "");
  const status = String(formData.get("status") || "") as SecurityControlStatus;
  if (!id || !SECURITY_CONTROL_STATUSES.includes(status)) {
    return { error: "Missing control or status." };
  }
  try {
    await updateSecurityControl(session, id, { status });
  } catch (error) {
    return { error: actionError(error, "Control action failed.") };
  }
  revalidatePath("/platform/security/controls");
  return { notice: "Status updated." };
}

const STATUS_TONE: Record<SecurityControlStatus, string> = {
  implemented: "text-emerald-700",
  partial: "text-amber-700",
  not_started: "text-red-700",
  not_applicable: "text-slate-500",
};

export default async function SecurityControlsPage() {
  const session = await requirePageRole(["platform_admin"]);
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
      <AdminCard className="mt-6 p-6">
        <h2 className="text-lg font-black">Add control</h2>
<AddControlForm
          action={createAction}
          criteria={SECURITY_CRITERIA}
          statuses={SECURITY_CONTROL_STATUSES}
        />
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
<ControlStatusForm
                      action={statusAction}
                      controlId={control.id}
                      current={control.status}
                      statuses={SECURITY_CONTROL_STATUSES}
                    />
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
