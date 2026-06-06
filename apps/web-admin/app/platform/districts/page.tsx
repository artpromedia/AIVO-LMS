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

const STATUSES: DistrictInviteStatus[] = ["pending", "accepted", "expired", "revoked"];

function actionError(error: unknown): string {
  return error instanceof AdminApiError ? error.message : "Invitation action failed.";
}

async function resendInvite(formData: FormData) {
  "use server";
  const session = await requirePageRole(["platform_admin"]);
  const id = String(formData.get("id") || "");
  try {
    await resendPlatformDistrictInvite(session, id);
  } catch (error) {
    redirect(`/platform/districts?error=${encodeURIComponent(actionError(error))}`);
  }
  redirect("/platform/districts?notice=Invitation%20resent.");
}

async function revokeInvite(formData: FormData) {
  "use server";
  const session = await requirePageRole(["platform_admin"]);
  const id = String(formData.get("id") || "");
  try {
    await revokePlatformDistrictInvite(session, id);
  } catch (error) {
    redirect(`/platform/districts?error=${encodeURIComponent(actionError(error))}`);
  }
  redirect("/platform/districts?notice=Invitation%20revoked.");
}

function formatDate(value: string | null): string {
  if (!value) return "Not yet";
  return new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeStyle: "short" }).format(
    new Date(value),
  );
}

export default async function DistrictInvitesPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; notice?: string; error?: string }>;
}) {
  const session = await requirePageRole(["platform_admin"]);
  const params = await searchParams;
  const status = STATUSES.includes(params.status as DistrictInviteStatus)
    ? (params.status as DistrictInviteStatus)
    : undefined;
  const { invites } = await listPlatformDistrictInvites(session, status);

  return (
    <AdminPageFrame
      eyebrow="Platform onboarding"
      title="District invitations"
      description="Track, resend, or revoke first-admin invitations across every district."
      action={
        <Link className="admin-button" href="/platform/districts/new">
          Onboard district
        </Link>
      }
    >
      <nav className="mt-8 flex flex-wrap gap-2">
        <Link className={`admin-filter ${!status ? "admin-filter-active" : ""}`} href="/platform/districts">
          All
        </Link>
        {STATUSES.map((item) => (
          <Link
            className={`admin-filter ${status === item ? "admin-filter-active" : ""}`}
            href={`/platform/districts?status=${item}`}
            key={item}
          >
            {item}
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
                <th>Sent</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {invites.map((invite) => (
                <tr key={invite.id}>
                  <td className="font-bold">{invite.districtName}</td>
                  <td>
                    <span className="block font-semibold">{invite.name}</span>
                    <span className="text-sm text-slate-500">{invite.email}</span>
                  </td>
                  <td>
                    <span className={`admin-status admin-status-${invite.status}`}>{invite.status}</span>
                  </td>
                  <td>{formatDate(invite.createdAt)}</td>
                  <td>
                    {invite.status === "pending" || invite.status === "expired" ? (
                      <div className="flex gap-2">
                        <form action={resendInvite}>
                          <input name="id" type="hidden" value={invite.id} />
                          <button className="admin-action" type="submit">
                            Resend
                          </button>
                        </form>
                        {invite.status === "pending" ? (
                          <form action={revokeInvite}>
                            <input name="id" type="hidden" value={invite.id} />
                            <button className="admin-action admin-action-danger" type="submit">
                              Revoke
                            </button>
                          </form>
                        ) : null}
                      </div>
                    ) : (
                      <span className="text-sm text-slate-400">No actions</span>
                    )}
                  </td>
                </tr>
              ))}
              {invites.length === 0 ? (
                <tr>
                  <td className="py-10 text-center text-slate-500" colSpan={5}>
                    No invitations match this filter.
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
