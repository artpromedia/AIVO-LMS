import Link from "next/link";
import { redirect } from "next/navigation";
import { requirePageRole, requirePlatformPage } from "@aivo/admin-auth";
import { listAiPolicies, updateAiPolicy } from "@aivo/admin-api/ai-governance";
import { AdminCard, AdminKpiCard, AdminPageFrame } from "@aivo/admin-ui";
import { formatDateTime } from "@/components/admin-format";
import { StatusPill } from "@/components/status-pill";
import { actionError } from "@/lib/action-errors";

async function toggleAction(formData: FormData) {
  "use server";
  const session = await requirePageRole(["platform_admin"]);
  const id = String(formData.get("id") || "");
  if (!id) redirect("/platform/ai/policies?error=Missing%20policy.");
  const enabled = String(formData.get("enabled") || "") === "true";
  try {
    await updateAiPolicy(session, id, { enabled });
  } catch (error) {
    redirect(`/platform/ai/policies?error=${encodeURIComponent(actionError(error, "Policy update failed."))}`);
  }
  redirect(
    `/platform/ai/policies?notice=${encodeURIComponent(
      `Policy ${enabled ? "enabled" : "disabled"}.`,
    )}`,
  );
}

export default async function AiPoliciesPage({
  searchParams,
}: {
  searchParams: Promise<{ notice?: string; error?: string }>;
}) {
  const session = await requirePlatformPage("platform:read");
  const params = await searchParams;
  const policies = await listAiPolicies(session);

  const enabled = policies.filter((p) => p.enabled).length;
  const platformScoped = policies.filter((p) => p.scopeLevel === "platform").length;

  return (
    <AdminPageFrame
      title="Safety policies"
      description="Stacked platform → district → tenant safety policies served by responsible-ai-svc."
      action={
        <Link className="admin-button admin-button-secondary" href="/platform/ai/models">
          Model registry
        </Link>
      }
    >
      {params.notice ? <p className="admin-notice mt-8">{params.notice}</p> : null}
      {params.error ? <p className="admin-error mt-8">{params.error}</p> : null}

      <section className="mt-8 grid gap-4 md:grid-cols-3">
        <AdminKpiCard label="Policies" value={policies.length} />
        <AdminKpiCard label="Enabled" value={enabled} />
        <AdminKpiCard label="Platform-scoped" value={platformScoped} />
      </section>

      <AdminCard className="mt-6 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Policy</th>
                <th>Scope</th>
                <th>Max severity</th>
                <th>Blocked categories</th>
                <th>Age gating</th>
                <th>Status</th>
                <th>Updated</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {policies.map((policy) => (
                <tr key={policy.id}>
                  <td className="font-bold">{policy.name}</td>
                  <td className="text-sm">
                    {policy.scopeLevel}
                    {policy.scopeId ? (
                      <span className="block text-slate-500">{policy.scopeId}</span>
                    ) : null}
                  </td>
                  <td className="text-sm uppercase">{policy.contentSafety.maxSeverity}</td>
                  <td className="max-w-xs truncate text-sm">
                    {policy.contentSafety.blockedCategories.length > 0
                      ? policy.contentSafety.blockedCategories.join(", ")
                      : "—"}
                  </td>
                  <td className="text-sm">
                    {policy.ageGating.minAge !== null ? `min ${policy.ageGating.minAge}` : "—"}
                    {policy.ageGating.requireGuardianConsent ? (
                      <span className="block text-amber-700">guardian consent</span>
                    ) : null}
                  </td>
                  <td>
                    <StatusPill status={policy.enabled ? "enabled" : "disabled"} />
                  </td>
                  <td className="text-sm tabular-nums">{formatDateTime(policy.updatedAt)}</td>
                  <td>
                    <form action={toggleAction}>
                      <input name="id" type="hidden" value={policy.id} />
                      <input name="enabled" type="hidden" value={policy.enabled ? "false" : "true"} />
                      <button className="admin-action" type="submit">
                        {policy.enabled ? "Disable" : "Enable"}
                      </button>
                    </form>
                  </td>
                </tr>
              ))}
              {policies.length === 0 ? (
                <tr>
                  <td className="py-10 text-center text-slate-500" colSpan={8}>
                    No safety policies defined.
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
