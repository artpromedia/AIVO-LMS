import { redirect } from "next/navigation";
import { requirePageRole } from "@aivo/admin-auth";
import { AdminApiError } from "@aivo/admin-api";
import {
  type PronunciationEncoding,
  type PronunciationScope,
  PRONUNCIATION_ENCODINGS,
  PRONUNCIATION_SCOPES,
  createPronunciationOverride,
  deletePronunciationOverride,
  listPronunciationOverrides,
} from "@aivo/admin-api/pronunciation";
import { AdminCard, AdminPageFrame } from "@aivo/admin-ui";
import { formatDateTime } from "@/components/admin-format";

function actionError(error: unknown): string {
  return error instanceof AdminApiError ? error.message : "Override action failed.";
}

async function createAction(formData: FormData) {
  "use server";
  const session = await requirePageRole(["platform_admin"]);
  const token = String(formData.get("token") || "").trim();
  const replacement = String(formData.get("replacement") || "").trim();
  if (!token || !replacement) {
    redirect("/platform/audio/pronunciation?error=Token%20and%20replacement%20are%20required.");
  }
  const scope = String(formData.get("scope") || "tenant") as PronunciationScope;
  const tenantId = String(formData.get("tenantId") || "").trim();
  if (scope === "tenant" && !tenantId) {
    redirect("/platform/audio/pronunciation?error=Tenant%20id%20is%20required%20for%20tenant%20scope.");
  }
  try {
    await createPronunciationOverride(session, {
      token,
      replacement,
      encoding: String(formData.get("encoding") || "plain") as PronunciationEncoding,
      scope,
      tenantId: scope === "platform" ? null : tenantId,
      notes: String(formData.get("notes") || "").trim() || null,
    });
  } catch (error) {
    redirect(`/platform/audio/pronunciation?error=${encodeURIComponent(actionError(error))}`);
  }
  redirect(`/platform/audio/pronunciation?notice=${encodeURIComponent(`Override for "${token}" added.`)}`);
}

async function deleteAction(formData: FormData) {
  "use server";
  const session = await requirePageRole(["platform_admin"]);
  const id = String(formData.get("id") || "");
  if (!id) redirect("/platform/audio/pronunciation?error=Missing%20override.");
  try {
    await deletePronunciationOverride(session, id);
  } catch (error) {
    redirect(`/platform/audio/pronunciation?error=${encodeURIComponent(actionError(error))}`);
  }
  redirect("/platform/audio/pronunciation?notice=Override%20removed.");
}

export default async function PronunciationPage({
  searchParams,
}: {
  searchParams: Promise<{ notice?: string; error?: string }>;
}) {
  const session = await requirePageRole(["platform_admin"]);
  const params = await searchParams;
  const overrides = await listPronunciationOverrides(session);

  return (
    <AdminPageFrame
      eyebrow="Platform · Audio"
      title="Pronunciation overrides"
      description="Token → SSML/phoneme replacements used by the read-aloud TTS adapter, persisted in admin-svc (Postgres)."
    >
      {params.notice ? <p className="admin-notice mt-8">{params.notice}</p> : null}
      {params.error ? <p className="admin-error mt-8">{params.error}</p> : null}

      <AdminCard className="mt-6 p-6">
        <h2 className="text-lg font-black">Add override</h2>
        <form action={createAction} className="mt-4 flex flex-wrap items-end gap-3">
          <input className="admin-input w-40" name="token" placeholder="Token" required />
          <input className="admin-input flex-1" name="replacement" placeholder="Replacement" required />
          <select className="admin-input" name="encoding" defaultValue="plain">
            {PRONUNCIATION_ENCODINGS.map((e) => (
              <option key={e} value={e}>
                {e}
              </option>
            ))}
          </select>
          <select className="admin-input" name="scope" defaultValue="tenant">
            {PRONUNCIATION_SCOPES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
          <input className="admin-input w-44" name="tenantId" placeholder="Tenant id (tenant scope)" />
          <input className="admin-input w-44" name="notes" placeholder="Notes" />
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
                <th>Token</th>
                <th>Replacement</th>
                <th>Encoding</th>
                <th>Scope</th>
                <th>Tenant</th>
                <th>Added</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {overrides.map((override) => (
                <tr key={override.id}>
                  <td className="font-bold">{override.token}</td>
                  <td className="font-mono text-sm">{override.replacement}</td>
                  <td className="text-sm">{override.encoding}</td>
                  <td>
                    <span className="admin-status">{override.scope}</span>
                  </td>
                  <td className="text-sm">{override.tenantId ?? "all"}</td>
                  <td className="text-sm">{formatDateTime(override.createdAt)}</td>
                  <td>
                    <form action={deleteAction}>
                      <input name="id" type="hidden" value={override.id} />
                      <button className="admin-action admin-action-danger" type="submit">
                        Remove
                      </button>
                    </form>
                  </td>
                </tr>
              ))}
              {overrides.length === 0 ? (
                <tr>
                  <td className="py-10 text-center text-slate-500" colSpan={7}>
                    No pronunciation overrides configured.
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
