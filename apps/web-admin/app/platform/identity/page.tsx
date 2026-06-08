import Link from "next/link";
import { redirect } from "next/navigation";
import { requirePageRole } from "@aivo/admin-auth";
import { AdminApiError } from "@aivo/admin-api";
import {
  type DistrictInviteStatus,
  listPlatformDistrictInvites,
  resendPlatformDistrictInvite,
  revokePlatformDistrictInvite,
} from "@aivo/admin-api/identity";
import { AdminCard, AdminPageFrame } from "@aivo/admin-ui";
import { formatDateTime } from "@/components/admin-format";

const STATUSES: DistrictInviteStatus[] = ["pending", "accepted", "expired", "revoked"];

function actionError(error: unknown): string {
  return error instanceof AdminApiError ? error.message : "Invitation action failed.";
}

async function resendAction(formData: FormData) {
  "use server";
  const session = await requirePageRole(["platform_admin"]);
  const id = String(formData.get("id") || "");
  if (!id) redirect("/platform/identity?error=Missing%20invite.");
  try {
    await resendPlatformDistrictInvite(session, id);
  } catch (error) {
    redirect(`/platform/identity?error=${encodeURIComponent(actionError(error))}`);
  }
  redirect("/platform/identity?notice=Invitation%20resent.");
}

async function revokeAction(formData: FormData) {
  "use server";
  const session = await requirePageRole(["platform_admin"]);
  const id = String(formData.get("id") || "");
  if (!id) redirect("/platform/identity?error=Missing%20invite.");
  try {
    await revokePlatformDistrictInvite(session, id);
  } catch (error) {
    redirect(`/platform/identity?error=${encodeURIComponent(actionError(error))}`);
  }
  redirect("/platform/identity?notice=Invitation%20revoked.");
}

export default async function PlatformIdentityPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; notice?: string; error?: string }>;
}) {
  const session = await requirePageRole(["platform_admin"]);
  const params = await searchParams;
  const statusFilter = STATUSES.includes(params.status as DistrictInviteStatus)
    ? (params.status as DistrictInviteStatus)
    : undefined;
  const { invites } = await listPlatformDistrictInvites(session, statusFilter);

  return (
    <AdminPageFrame
      eyebrow="Platform"
      title="Enterprise identity"
      description="District administrator invitations and per-tenant SCIM provisioning tokens."
      action={
        <Link className="admin-button" href="/platform/districts/new">
          Onboard district
        </Link>
      }
    >
      <nav className="mt-8 flex flex-wrap gap-2">
        <Link
          className={`admin-filter ${!statusFilter ? "admin-filter-active" : ""}`}
          href="/platform/identity"
        >
          All
        </Link>
        {STATUSES.map((status) => (
          <Link
            className={`admin-filter ${statusFilter === status ? "admin-filter-active" : ""}`}
            href={`/platform/identity?status=${status}`}
            key={status}
          >
            {status}
          </Link>
        ))}
      </nav>

      {params.notice ? <p className="admin-notice mt-5">{params.notice}</p> : null}
      {params.error ? <p className="admin-error mt-5">{params.error}</p> : null}

      <AdminCard className="mt-6 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="admin-table">
            <thead>
              <tr>
                <th>District</th>
                <th>Invitee</th>
                <th>Status</th>
                <th>Expires</th>
                <th>SCIM</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {invites.map((invite) => (
                <tr key={invite.id}>
                  <td className="font-bold">{invite.districtName}</td>
                  <td>
                    <span className="block">{invite.name}</span>
                    <span className="text-sm font-normal text-slate-500">{invite.email}</span>
                  </td>
                  <td>
                    <span className={`admin-status admin-status-${invite.status}`}>
                      {invite.status}
                    </span>
                  </td>
                  <td className="text-sm">{formatDateTime(invite.expiresAt)}</td>
                  <td className="text-sm">
                    <Link
                      className="font-semibold text-blue-700"
                      href={`/platform/identity/${invite.tenantId}`}
                    >
                      Tokens
                    </Link>
                  </td>
                  <td>
                    {invite.status === "pending" ? (
                      <div className="flex items-center gap-2">
                        <form action={resendAction}>
                          <input name="id" type="hidden" value={invite.id} />
                          <button className="admin-action" type="submit">
                            Resend
                          </button>
                        </form>
                        <form action={revokeAction}>
                          <input name="id" type="hidden" value={invite.id} />
                          <button className="admin-action admin-action-danger" type="submit">
                            Revoke
                          </button>
                        </form>
                      </div>
                    ) : (
                      <span className="text-sm text-slate-400">—</span>
                    )}
                  </td>
                </tr>
              ))}
              {invites.length === 0 ? (
                <tr>
                  <td className="py-10 text-center text-slate-500" colSpan={6}>
                    No district invitations match this filter.
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
