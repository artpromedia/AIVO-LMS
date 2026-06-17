import Link from "next/link";
import { redirect } from "next/navigation";
import { requirePageRole, requirePlatformPage } from "@aivo/admin-auth";
import { createAiOptOut, deleteAiOptOut, listAiOptOuts } from "@aivo/admin-api/ai-governance";
import { AdminCard, AdminKpiCard, AdminPageFrame , ConfirmDangerDialog } from "@aivo/admin-ui";
import { formatDateTime } from "@/components/admin-format";
import { actionError } from "@/lib/action-errors";

function tenantQuery(tenantId?: string): string {
  return tenantId ? `?tenantId=${encodeURIComponent(tenantId)}` : "";
}

async function createAction(formData: FormData) {
  "use server";
  const session = await requirePageRole(["platform_admin"]);
  const tenantId = String(formData.get("tenantId") || "").trim();
  const modelId = String(formData.get("modelId") || "").trim() || null;
  const feature = String(formData.get("feature") || "").trim() || null;
  const reason = String(formData.get("reason") || "").trim();
  if (!modelId && !feature) {
    const prefix = `/platform/ai/optouts${tenantQuery(tenantId)}`;
    redirect(`${prefix}${tenantId ? "&" : "?"}error=Model%20or%20feature%20is%20required.`);
  }
  try {
    await createAiOptOut(session, {
      tenantId: tenantId || undefined,
      modelId,
      feature,
      reason,
    });
  } catch (error) {
    redirect(`/platform/ai/optouts?error=${encodeURIComponent(actionError(error, "Opt-out action failed."))}`);
  }
  redirect(`/platform/ai/optouts${tenantQuery(tenantId)}${tenantId ? "&" : "?"}notice=Opt-out%20created.`);
}

async function deleteAction(formData: FormData) {
  "use server";
  const session = await requirePageRole(["platform_admin"]);
  const id = String(formData.get("id") || "");
  if (!id) redirect("/platform/ai/optouts?error=Missing%20opt-out.");
  try {
    await deleteAiOptOut(session, id);
  } catch (error) {
    redirect(`/platform/ai/optouts?error=${encodeURIComponent(actionError(error, "Opt-out action failed."))}`);
  }
  redirect("/platform/ai/optouts?notice=Opt-out%20removed.");
}

export default async function AiOptOutsPage({
  searchParams,
}: {
  searchParams: Promise<{ tenantId?: string; notice?: string; error?: string }>;
}) {
  const session = await requirePlatformPage("platform:read");
  const params = await searchParams;
  const tenantId = params.tenantId?.trim() || undefined;
  const optOuts = await listAiOptOuts(session, tenantId);

  const modelScoped = optOuts.filter((o) => o.modelId).length;
  const featureScoped = optOuts.filter((o) => o.feature).length;

  return (
    <AdminPageFrame
      title="Opt-outs"
      description="Per-tenant model and feature opt-outs served by responsible-ai-svc."
      action={
        <Link className="admin-button admin-button-secondary" href="/platform/ai/policies">
          Safety policies
        </Link>
      }
    >
      {params.notice ? <p className="admin-notice mt-8">{params.notice}</p> : null}
      {params.error ? <p className="admin-error mt-8">{params.error}</p> : null}

      <section className="mt-8 grid gap-4 md:grid-cols-3">
        <AdminKpiCard label="Opt-outs" value={optOuts.length} />
        <AdminKpiCard label="Model-scoped" value={modelScoped} />
        <AdminKpiCard label="Feature-scoped" value={featureScoped} />
      </section>

      <AdminCard className="mt-6 p-6">
        <h2 className="text-lg font-black">Filter by tenant</h2>
        <form className="mt-4 flex flex-wrap items-end gap-3" method="get">
          <input
            className="admin-input flex-1"
            name="tenantId"
            placeholder="Tenant ID"
            defaultValue={tenantId ?? ""}
          />
          <button className="admin-button admin-button-secondary" type="submit">
            Filter
          </button>
        </form>
      </AdminCard>

      <AdminCard className="mt-6 p-6">
        <h2 className="text-lg font-black">Create opt-out</h2>
        <form action={createAction} className="mt-4 flex flex-wrap items-end gap-3">
          <input
            className="admin-input"
            name="tenantId"
            placeholder="Tenant ID (optional)"
            defaultValue={tenantId ?? ""}
          />
          <input className="admin-input" name="modelId" placeholder="Model ID" />
          <input className="admin-input" name="feature" placeholder="Feature key" />
          <input className="admin-input flex-1" name="reason" placeholder="Reason" />
          <button className="admin-button" type="submit">
            Create
          </button>
        </form>
        <p className="mt-2 text-sm text-slate-500">Provide a model ID or a feature key (or both).</p>
      </AdminCard>

      <AdminCard className="mt-6 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Tenant</th>
                <th>Model</th>
                <th>Feature</th>
                <th>Reason</th>
                <th>Created by</th>
                <th>Created</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {optOuts.map((optOut) => (
                <tr key={optOut.id}>
                  <td className="font-bold">{optOut.tenantId}</td>
                  <td className="text-sm">{optOut.modelId ?? "—"}</td>
                  <td className="text-sm">{optOut.feature ?? "—"}</td>
                  <td className="max-w-xs truncate text-sm">{optOut.reason || "—"}</td>
                  <td className="text-sm">
                    {optOut.createdBy}
                    <span className="block text-slate-500">{optOut.createdByRole}</span>
                  </td>
                  <td className="text-sm tabular-nums">{formatDateTime(optOut.createdAt)}</td>
                  <td>
                    <ConfirmDangerDialog
                      action={deleteAction}
                      hiddenFields={{ id: optOut.id }}
                      trigger="Remove"
                      triggerClassName="admin-action"
                      title="Remove this LLM opt-out?"
                      body="AI processing resumes for this scope. Make sure the family or district asked for this in writing."
                      confirmLabel="Remove opt-out"
                    />
                  </td>
                </tr>
              ))}
              {optOuts.length === 0 ? (
                <tr>
                  <td className="py-10 text-center text-slate-500" colSpan={7}>
                    No opt-outs match this filter.
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
