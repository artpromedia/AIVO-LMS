import Link from "next/link";
import { redirect } from "next/navigation";
import { requirePageRole } from "@aivo/admin-auth";
import {
  type DistrictInviteStatus,
  listPlatformDistrictInvites,
  resendPlatformDistrictInvite,
  revokePlatformDistrictInvite,
} from "@aivo/admin-api/identity";
import { AdminCard, AdminPageFrame, BulkSelectionBar, ConfirmDangerDialog } from "@aivo/admin-ui";
import { StatusPill } from "@/components/status-pill";
import { actionError } from "@/lib/action-errors";

const STATUSES: DistrictInviteStatus[] = ["pending", "accepted", "expired", "revoked"];

async function resendInvite(formData: FormData) {
  "use server";
  const session = await requirePageRole(["platform_admin"]);
  const id = String(formData.get("id") || "");
  try {
    await resendPlatformDistrictInvite(session, id);
  } catch (error) {
    redirect(`/platform/districts?error=${encodeURIComponent(actionError(error, "Invitation action failed."))}`);
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
    redirect(`/platform/districts?error=${encodeURIComponent(actionError(error, "Invitation action failed."))}`);
  }
  redirect("/platform/districts?notice=Invitation%20revoked.");
}

async function bulkRevokeInvites(formData: FormData) {
  "use server";
  const session = await requirePageRole(["platform_admin"]);
  const ids = String(formData.get("ids") || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  if (ids.length === 0) redirect("/platform/districts");
  let revoked = 0;
  let failed = 0;
  for (const id of ids) {
    try {
      await revokePlatformDistrictInvite(session, id);
      revoked += 1;
    } catch {
      failed += 1;
    }
  }
  const notice =
    failed > 0
      ? `Bulk revoke: ${revoked} revoked, ${failed} failed.`
      : `Bulk revoke: ${revoked} invitation(s) revoked.`;
  redirect(`/platform/districts?notice=${encodeURIComponent(notice)}`);
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
        <div className="px-4 pt-4">
          <BulkSelectionBar
            checkboxName="bulk-district-invites"
            action={bulkRevokeInvites}
            triggerLabel="Revoke selected ({count})"
            title="Revoke selected invitations?"
            body="{count} selected invitation(s) will be revoked. The invitees will no longer be able to accept them; you can send new invitations later."
            confirmLabel="Revoke {count} invitation(s)"
          />
        </div>
        <div className="overflow-x-auto">
          <table className="admin-table">
            <thead>
              <tr>
                <th>
                  <span className="sr-only">Select</span>
                </th>
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
                  <td>
                    {invite.status === "pending" ? (
                      <input
                        type="checkbox"
                        name="bulk-district-invites"
                        value={invite.id}
                        aria-label={`Select invitation for ${invite.email}`}
                        className="h-4 w-4 accent-violet-700"
                      />
                    ) : null}
                  </td>
                  <td className="font-bold">{invite.districtName}</td>
                  <td>
                    <span className="block font-semibold">{invite.name}</span>
                    <span className="text-sm text-slate-500">{invite.email}</span>
                  </td>
                  <td>
                    <StatusPill status={invite.status} />
                  </td>
                  <td className="tabular-nums">{formatDate(invite.createdAt)}</td>
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
                          <ConfirmDangerDialog
                            action={revokeInvite}
                            hiddenFields={{ id: invite.id }}
                            trigger="Revoke"
                            triggerClassName="admin-action admin-action-danger"
                            title="Revoke this invitation?"
                            body={`${invite.email} will no longer be able to accept it. You can send a new invitation later.`}
                            confirmLabel="Revoke invitation"
                          />
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
                  <td className="py-10 text-center text-slate-500" colSpan={6}>
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
