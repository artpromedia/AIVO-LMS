import Link from "next/link";
import { redirect } from "next/navigation";
import { requirePageRole } from "@aivo/admin-auth";
import { AdminApiError } from "@aivo/admin-api";
import {
  inviteDistrictParent,
  listDistrictParents,
  revokeDistrictParentInvite,
  resendDistrictParentInvite,
  bulkInviteDistrictParents,
  type BulkParentResult,
} from "@aivo/admin-api/identity";
import { AdminCard, AdminPageFrame, BulkSelectionBar, ConfirmDangerDialog } from "@aivo/admin-ui";

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <AdminCard className="p-5">
      <p className="text-sm font-semibold text-slate-500">{label}</p>
      <p className="mt-2 text-3xl font-black">{value}</p>
    </AdminCard>
  );
}

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

function errorMessage(error: unknown, fallback: string): string {
  return error instanceof AdminApiError ? error.message : fallback;
}

/** Parse a name,email CSV (skips a header row + blank lines). */
function parseCsv(text: string): Array<{ name: string; email: string }> {
  const rows: Array<{ name: string; email: string }> = [];
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    const [name, email] = trimmed.split(",").map((s) => s.trim());
    if (name?.toLowerCase() === "name" && email?.toLowerCase() === "email") continue;
    rows.push({ name: name ?? "", email: email ?? "" });
  }
  return rows;
}

async function inviteParentAction(formData: FormData) {
  "use server";
  const session = await requirePageRole(["district_admin"]);
  const name = String(formData.get("name") || "").trim();
  const email = String(formData.get("email") || "")
    .trim()
    .toLowerCase();
  if (!name || !EMAIL_RE.test(email)) {
    redirect("/district/parents?error=Enter%20a%20name%20and%20a%20valid%20email.");
  }
  try {
    await inviteDistrictParent(session, { name, email });
  } catch (error) {
    redirect(
      `/district/parents?error=${encodeURIComponent(errorMessage(error, "Invite failed."))}`,
    );
  }
  redirect(`/district/parents?invited=${encodeURIComponent(email)}`);
}

async function bulkInviteAction(formData: FormData) {
  "use server";
  const session = await requirePageRole(["district_admin"]);
  const csv = String(formData.get("csv") || "");
  const rows = parseCsv(csv);
  if (rows.length === 0) {
    redirect("/district/parents?error=Paste%20at%20least%20one%20name%2Cemail%20row.");
  }
  let result: { invited: number; total: number; results: BulkParentResult[] };
  try {
    result = await bulkInviteDistrictParents(session, rows);
  } catch (error) {
    redirect(
      `/district/parents?error=${encodeURIComponent(errorMessage(error, "Bulk invite failed."))}`,
    );
  }
  const skipped = result.results.filter((r) => r.status !== "invited").length;
  redirect(
    `/district/parents?bulkInvited=${result.invited}&bulkTotal=${result.total}&bulkSkipped=${skipped}`,
  );
}

async function revokeParentAction(formData: FormData) {
  "use server";
  const session = await requirePageRole(["district_admin"]);
  const id = String(formData.get("id") || "");
  if (!id) redirect("/district/parents");
  try {
    await revokeDistrictParentInvite(session, id);
  } catch (error) {
    redirect(
      `/district/parents?error=${encodeURIComponent(errorMessage(error, "Revoke failed."))}`,
    );
  }
  redirect("/district/parents?revoked=1");
}

async function bulkRevokeParentsAction(formData: FormData) {
  "use server";
  const session = await requirePageRole(["district_admin"]);
  const ids = String(formData.get("ids") || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  if (ids.length === 0) redirect("/district/parents");
  let revoked = 0;
  let failed = 0;
  for (const id of ids) {
    try {
      await revokeDistrictParentInvite(session, id);
      revoked += 1;
    } catch {
      failed += 1;
    }
  }
  redirect(`/district/parents?bulkRevoked=${revoked}&bulkRevokeFailed=${failed}`);
}

async function resendParentAction(formData: FormData) {
  "use server";
  const session = await requirePageRole(["district_admin"]);
  const id = String(formData.get("id") || "");
  if (!id) redirect("/district/parents");
  try {
    await resendDistrictParentInvite(session, id);
  } catch (error) {
    redirect(
      `/district/parents?error=${encodeURIComponent(errorMessage(error, "Resend failed."))}`,
    );
  }
  redirect("/district/parents?resent=1");
}

const STATUS_STYLE: Record<string, string> = {
  pending: "bg-amber-100 text-amber-800",
  accepted: "bg-emerald-100 text-emerald-800",
  revoked: "bg-slate-200 text-slate-600",
  expired: "bg-red-100 text-red-700",
};

export default async function DistrictParentsPage({
  searchParams,
}: {
  searchParams: Promise<{
    invited?: string;
    revoked?: string;
    resent?: string;
    bulkInvited?: string;
    bulkTotal?: string;
    bulkSkipped?: string;
    bulkRevoked?: string;
    bulkRevokeFailed?: string;
    error?: string;
  }>;
}) {
  const session = await requirePageRole(["district_admin"]);
  const params = await searchParams;

  let data: Awaited<ReturnType<typeof listDistrictParents>> | null = null;
  let loadError: string | null = null;
  try {
    data = await listDistrictParents(session);
  } catch (error) {
    loadError = errorMessage(error, "Could not load parents.");
  }

  const seats = data?.seats ?? null;
  const remainingLabel =
    seats == null ? "—" : seats.remaining == null ? "Unlimited" : String(seats.remaining);
  const atCap = seats?.remaining != null && seats.remaining <= 0;

  return (
    <AdminPageFrame
      eyebrow="District setup"
      title="Invite parents"
      description="Invite parents into your district. They set their own password — no temporary password is ever emailed — and their account lives under your district."
      action={
        <Link className="admin-button admin-button-secondary" href="/district">
          Back to district
        </Link>
      }
    >
      {params.invited ? (
        <p className="mt-6 rounded-xl border border-emerald-200 bg-emerald-50 p-4 font-semibold text-emerald-800">
          Invitation emailed to {params.invited}.
        </p>
      ) : null}
      {params.bulkInvited ? (
        <p className="mt-6 rounded-xl border border-emerald-200 bg-emerald-50 p-4 font-semibold text-emerald-800">
          Bulk invite: {params.bulkInvited} of {params.bulkTotal} invited
          {Number(params.bulkSkipped) > 0
            ? `, ${params.bulkSkipped} skipped (duplicate / over cap / invalid).`
            : "."}
        </p>
      ) : null}
      {params.revoked ? (
        <p className="mt-6 rounded-xl border border-slate-200 bg-slate-50 p-4 font-semibold text-slate-700">
          Invitation revoked.
        </p>
      ) : null}
      {params.bulkRevoked ? (
        <p className="mt-6 rounded-xl border border-slate-200 bg-slate-50 p-4 font-semibold text-slate-700">
          Bulk revoke: {params.bulkRevoked} invitation(s) revoked
          {Number(params.bulkRevokeFailed) > 0 ? `, ${params.bulkRevokeFailed} failed.` : "."}
        </p>
      ) : null}
      {params.resent ? (
        <p className="mt-6 rounded-xl border border-slate-200 bg-slate-50 p-4 font-semibold text-slate-700">
          Invitation resent.
        </p>
      ) : null}
      {params.error ? (
        <p className="mt-6 rounded-xl border border-red-200 bg-red-50 p-4 font-semibold text-red-800">
          {params.error}
        </p>
      ) : null}

      <div className="mt-8 grid gap-4 sm:grid-cols-3">
        <StatCard
          label="Seat cap"
          value={seats?.seatLimit == null ? "Unlimited" : String(seats.seatLimit)}
        />
        <StatCard
          label="Committed (parents + pending)"
          value={seats ? String(seats.committed) : "—"}
        />
        <StatCard label="Remaining seats" value={remainingLabel} />
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        <AdminCard className="p-6">
          <h2 className="text-xl font-black">Invite one parent</h2>
          <form action={inviteParentAction} className="mt-4 space-y-4">
            <div>
              <label className="admin-label" htmlFor="name">
                Full name
              </label>
              <input className="admin-input mt-2" id="name" name="name" required />
            </div>
            <div>
              <label className="admin-label" htmlFor="email">
                Email
              </label>
              <input
                className="admin-input mt-2"
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                required
              />
            </div>
            <button className="admin-button w-full" type="submit" disabled={atCap}>
              {atCap ? "Seat limit reached" : "Send invitation"}
            </button>
          </form>
        </AdminCard>

        <AdminCard className="p-6">
          <h2 className="text-xl font-black">Bulk invite (CSV)</h2>
          <p className="mt-2 text-sm text-slate-500">
            One <code>name,email</code> per line. A <code>name,email</code> header row is ignored.
          </p>
          <form action={bulkInviteAction} className="mt-4 space-y-4">
            <textarea
              className="admin-input min-h-[140px] font-mono text-sm"
              name="csv"
              placeholder={"Jordan Rivera,jordan@example.com\nSam Lee,sam@example.com"}
              required
            />
            <button className="admin-button w-full" type="submit" disabled={atCap}>
              {atCap ? "Seat limit reached" : "Invite from CSV"}
            </button>
          </form>
        </AdminCard>
      </div>

      <AdminCard className="mt-6 p-6">
        <h2 className="text-xl font-black">Parents</h2>
        {loadError ? (
          <p className="mt-4 rounded-xl border border-red-200 bg-red-50 p-4 text-red-800">
            {loadError}
          </p>
        ) : data && data.parents.length > 0 ? (
          <div className="mt-4 overflow-x-auto">
            <div className="mb-3">
              <BulkSelectionBar
                checkboxName="bulk-parent-invites"
                action={bulkRevokeParentsAction}
                triggerLabel="Revoke selected ({count})"
                title="Revoke selected invitations?"
                body="{count} selected invitation(s) will be revoked. Seats open back up; you can re-invite at any time."
                confirmLabel="Revoke {count} invitation(s)"
              />
            </div>
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500">
                  <th className="py-2">
                    <span className="sr-only">Select</span>
                  </th>
                  <th className="py-2">Name</th>
                  <th className="py-2">Email</th>
                  <th className="py-2">Status</th>
                  <th className="py-2 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {data.parents.map((p) => (
                  <tr key={p.id} className="border-b border-slate-100">
                    <td className="py-3 pr-2">
                      {p.status === "pending" || p.status === "expired" ? (
                        <input
                          type="checkbox"
                          name="bulk-parent-invites"
                          value={p.id}
                          aria-label={`Select invitation for ${p.email}`}
                          className="h-4 w-4 accent-blue-700"
                        />
                      ) : null}
                    </td>
                    <td className="py-3 font-semibold">{p.name}</td>
                    <td className="py-3 text-slate-600">{p.email}</td>
                    <td className="py-3">
                      <span
                        className={`rounded-full px-2.5 py-1 text-xs font-bold ${STATUS_STYLE[p.status] ?? "bg-slate-100 text-slate-600"}`}
                      >
                        {p.status}
                      </span>
                    </td>
                    <td className="py-3 text-right">
                      {p.status === "pending" || p.status === "expired" ? (
                        <div className="inline-flex gap-2">
                          <form action={resendParentAction}>
                            <input type="hidden" name="id" value={p.id} />
                            <button
                              className="admin-button admin-button-secondary px-3 py-1 text-xs"
                              type="submit"
                            >
                              Resend
                            </button>
                          </form>
                          <ConfirmDangerDialog
                            action={revokeParentAction}
                            hiddenFields={{ id: p.id }}
                            trigger="Revoke"
                            triggerClassName="admin-button admin-button-secondary px-3 py-1 text-xs"
                            title="Revoke this parent invitation?"
                            body={`${p.email} will lose this invitation. A seat opens back up; you can re-invite at any time.`}
                            confirmLabel="Revoke invitation"
                          />
                        </div>
                      ) : (
                        <span className="text-xs text-slate-400">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="mt-4 text-slate-500">
            No parents invited yet. Use the form above to get started.
          </p>
        )}
      </AdminCard>
    </AdminPageFrame>
  );
}
