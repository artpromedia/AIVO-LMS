/**
 * Per-tenant feature flags (Sprint B2) — platform admins pilot a flag for
 * ONE district, or kill an override, without a deploy. Three-state view
 * per flag: environment default / override ON / override OFF, plus the
 * env kill switch indicator (which beats everything). Changes append to
 * the tenant's hash-chained activity log and take effect within the
 * resolver's 30s cache window.
 */
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { requirePlatformPage } from "@aivo/admin-auth";
import { IDENTITY_ACCESS_TOKEN_COOKIE } from "@aivo/admin-auth/identity-client";
import { AdminCard, AdminPageFrame } from "@aivo/admin-ui";
import { actionError } from "@/lib/action-errors";

const IDENTITY_URL = process.env.IDENTITY_SVC_URL || "http://localhost:3001";

interface FlagRow {
  key: string;
  envVar: string;
  default: boolean;
  override: boolean | null;
  killed: boolean;
  effective: boolean;
}

async function bearer(): Promise<string> {
  const jar = await cookies();
  return jar.get(IDENTITY_ACCESS_TOKEN_COOKIE)?.value ?? "";
}

async function readFlags(tenantId: string): Promise<FlagRow[]> {
  const res = await fetch(
    `${IDENTITY_URL}/api/admin/tenants/${encodeURIComponent(tenantId)}/flags`,
    { headers: { authorization: `Bearer ${await bearer()}` }, cache: "no-store" },
  );
  if (!res.ok) throw new Error(`flag read failed (${res.status})`);
  const json = (await res.json()) as { flags?: FlagRow[] };
  return json.flags ?? [];
}

async function setOverrideAction(formData: FormData) {
  "use server";
  const tenantId = String(formData.get("tenantId") || "");
  const flagKey = String(formData.get("flagKey") || "");
  const valueRaw = String(formData.get("value") || "clear");
  const enabled = valueRaw === "clear" ? null : valueRaw === "on";
  try {
    const res = await fetch(
      `${IDENTITY_URL}/api/admin/tenants/${encodeURIComponent(tenantId)}/flags/${encodeURIComponent(flagKey)}`,
      {
        method: "PATCH",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${(await cookies()).get(IDENTITY_ACCESS_TOKEN_COOKIE)?.value ?? ""}`,
        },
        body: JSON.stringify({ enabled }),
        cache: "no-store",
      },
    );
    if (!res.ok) {
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      throw Object.assign(new Error(body.error ?? "flag update failed"), { status: res.status });
    }
  } catch (error) {
    redirect(
      `/platform/tenants/${encodeURIComponent(tenantId)}/flags?error=${encodeURIComponent(
        actionError(error, "Flag update failed."),
      )}`,
    );
  }
  revalidatePath(`/platform/tenants/${tenantId}/flags`);
  redirect(`/platform/tenants/${encodeURIComponent(tenantId)}/flags?notice=saved`);
}

export default async function TenantFlagsPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string; notice?: string }>;
}) {
  await requirePlatformPage("platform:read");
  const { id } = await params;
  const sp = await searchParams;
  const flags = await readFlags(id);

  return (
    <AdminPageFrame
      title="Tenant feature flags"
      description="Per-district overrides over the environment defaults. The env kill switch (AIVO_KILL_*) beats everything for emergency shut-off."
    >
      {sp.notice === "saved" ? (
        <p className="admin-notice mt-6" role="status">
          Override saved. Live within the 30-second resolver cache window.
        </p>
      ) : null}
      {sp.error ? (
        <p className="admin-error mt-6" role="alert">
          {sp.error}
        </p>
      ) : null}

      <AdminCard className="mt-8 p-6">
        <div className="overflow-x-auto">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Flag</th>
                <th>Env default</th>
                <th>Override</th>
                <th>Effective</th>
                <th>Change</th>
              </tr>
            </thead>
            <tbody>
              {flags.map((flag) => (
                <tr key={flag.key}>
                  <td>
                    <span className="font-semibold">{flag.key}</span>
                    <span className="block font-mono text-xs text-slate-500">{flag.envVar}</span>
                    {flag.killed ? (
                      <span className="admin-status mt-1 inline-block bg-red-100 text-red-800">
                        KILLED via {`AIVO_KILL_${flag.envVar.replace(/^AIVO_FEATURE_/, "")}`}
                      </span>
                    ) : null}
                  </td>
                  <td>{flag.default ? "on" : "off"}</td>
                  <td>{flag.override === null ? "—" : flag.override ? "ON" : "OFF"}</td>
                  <td className="font-semibold">{flag.effective ? "on" : "off"}</td>
                  <td>
                    <form action={setOverrideAction} className="flex items-center gap-2">
                      <input type="hidden" name="tenantId" value={id} />
                      <input type="hidden" name="flagKey" value={flag.key} />
                      <select
                        className="admin-input !mt-0 !w-auto"
                        name="value"
                        defaultValue={flag.override === null ? "clear" : flag.override ? "on" : "off"}
                        aria-label={`Override for ${flag.key}`}
                      >
                        <option value="clear">Use default</option>
                        <option value="on">Override ON</option>
                        <option value="off">Override OFF</option>
                      </select>
                      <button className="admin-button-secondary" type="submit">
                        Apply
                      </button>
                    </form>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-4 text-sm text-slate-600">
          Every change appends <code className="font-mono text-xs">feature_flag.override_changed</code>{" "}
          to this tenant's hash-chained activity log.
        </p>
      </AdminCard>
    </AdminPageFrame>
  );
}
