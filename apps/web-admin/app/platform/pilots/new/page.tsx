import Link from "next/link";
import { redirect } from "next/navigation";
import { requirePageRole } from "@aivo/admin-auth";
import { AdminApiError } from "@aivo/admin-api";
import { provisionPilot } from "@aivo/admin-api/identity";
import { AdminCard, AdminPageFrame } from "@aivo/admin-ui";

const DEFAULT_SEAT_LIMIT = 50;
const DEFAULT_DURATION_DAYS = 90;

function errorMessage(error: unknown): string {
  return error instanceof AdminApiError ? error.message : "Pilot provisioning failed.";
}

async function provisionPilotAction(formData: FormData) {
  "use server";
  const session = await requirePageRole(["platform_admin"]);
  const districtName = String(formData.get("districtName") || "").trim();
  const adminName = String(formData.get("adminName") || "").trim();
  const adminEmail = String(formData.get("adminEmail") || "")
    .trim()
    .toLowerCase();
  const seatLimit = Number.parseInt(String(formData.get("seatLimit") || ""), 10);
  const durationDays = Number.parseInt(String(formData.get("durationDays") || ""), 10);

  if (!districtName || !adminName || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(adminEmail)) {
    redirect(
      "/platform/pilots/new?error=Enter%20a%20district%20name%2C%20admin%20name%2C%20and%20valid%20email.",
    );
  }

  const seats = Number.isInteger(seatLimit) && seatLimit > 0 ? seatLimit : DEFAULT_SEAT_LIMIT;
  const days =
    Number.isInteger(durationDays) && durationDays > 0 ? durationDays : DEFAULT_DURATION_DAYS;

  let result;
  try {
    result = await provisionPilot(session, {
      districtName,
      adminName,
      adminEmail,
      seatLimit: seats,
      durationDays: days,
    });
  } catch (error) {
    redirect(`/platform/pilots/new?error=${encodeURIComponent(errorMessage(error))}`);
  }

  const query = new URLSearchParams({
    created: result.district.name,
    email: result.invite.email,
    seats: String(result.pilot.seatLimit ?? seats),
  });
  if (result.pilot.expiresAt) query.set("expiresAt", result.pilot.expiresAt);
  if (result.pilot.couponCode) query.set("couponCode", result.pilot.couponCode);
  if (result.invite.inviteUrl) query.set("inviteUrl", result.invite.inviteUrl);
  redirect(`/platform/pilots/new?${query.toString()}`);
}

export default async function NewPilotPage({
  searchParams,
}: {
  searchParams: Promise<{
    created?: string;
    email?: string;
    seats?: string;
    expiresAt?: string;
    couponCode?: string;
    inviteUrl?: string;
    error?: string;
  }>;
}) {
  await requirePageRole(["platform_admin"]);
  const params = await searchParams;
  const expiry = params.expiresAt ? new Date(params.expiresAt) : null;

  return (
    <AdminPageFrame
      title="Provision a district pilot"
      description="Create the district tenant, provision its pilot entitlement (seat cap + active subscription) automatically, and email a secure invitation to its first administrator — in one step. No coupon to re-key."
      action={
        <Link className="admin-button admin-button-secondary" href="/platform/districts">
          Manage invitations
        </Link>
      }
    >
      {params.created && params.email ? (
        <AdminCard className="mt-8 border-emerald-200 p-6">
          <p className="text-sm font-bold uppercase tracking-[0.2em] text-emerald-700">
            Pilot provisioned
          </p>
          <h2 className="mt-3 text-2xl font-black">
            {params.created} is live with its entitlement
          </h2>
          <p className="mt-2 text-slate-600">
            A secure invitation was emailed to {params.email}. No temporary password was created or
            shown.
          </p>
          <dl className="mt-4 grid gap-3 sm:grid-cols-3">
            <div className="rounded-xl bg-slate-50 p-4">
              <dt className="text-xs font-bold uppercase tracking-wide text-slate-500">Seat cap</dt>
              <dd className="mt-1 text-xl font-black">{params.seats ?? "—"}</dd>
            </div>
            <div className="rounded-xl bg-slate-50 p-4">
              <dt className="text-xs font-bold uppercase tracking-wide text-slate-500">
                Pilot expires
              </dt>
              <dd className="mt-1 text-xl font-black">
                {expiry ? expiry.toLocaleDateString() : "—"}
              </dd>
            </div>
            <div className="rounded-xl bg-slate-50 p-4">
              <dt className="text-xs font-bold uppercase tracking-wide text-slate-500">
                Provisioning code
              </dt>
              <dd className="mt-1 break-all text-xl font-black">{params.couponCode ?? "—"}</dd>
            </div>
          </dl>
          {params.inviteUrl ? (
            <p className="mt-4 break-all rounded-xl bg-amber-50 p-4 text-sm text-amber-900">
              Local development invitation: {params.inviteUrl}
            </p>
          ) : null}
        </AdminCard>
      ) : null}

      {params.error ? (
        <p className="mt-8 rounded-xl border border-red-200 bg-red-50 p-4 font-semibold text-red-800">
          {params.error}
        </p>
      ) : null}

      <form action={provisionPilotAction} className="mt-8 grid gap-6 lg:grid-cols-2">
        <AdminCard className="p-6">
          <p className="admin-step">Step 1</p>
          <h2 className="mt-3 text-2xl font-black">District &amp; pilot terms</h2>
          <label className="admin-label mt-6" htmlFor="districtName">
            District name
          </label>
          <input
            className="admin-input mt-2"
            id="districtName"
            name="districtName"
            minLength={2}
            required
            placeholder="North Valley School District"
          />
          <div className="mt-5 grid grid-cols-2 gap-4">
            <div>
              <label className="admin-label" htmlFor="seatLimit">
                Seat cap
              </label>
              <input
                className="admin-input mt-2"
                id="seatLimit"
                name="seatLimit"
                type="number"
                min={1}
                defaultValue={DEFAULT_SEAT_LIMIT}
                required
              />
            </div>
            <div>
              <label className="admin-label" htmlFor="durationDays">
                Pilot length (days)
              </label>
              <input
                className="admin-input mt-2"
                id="durationDays"
                name="durationDays"
                type="number"
                min={1}
                max={3650}
                defaultValue={DEFAULT_DURATION_DAYS}
                required
              />
            </div>
          </div>
          <p className="mt-3 text-sm text-slate-500">
            Creates an isolated B2B district tenant and provisions its seat cap + active
            subscription atomically.
          </p>
        </AdminCard>

        <AdminCard className="p-6">
          <p className="admin-step">Step 2</p>
          <h2 className="mt-3 text-2xl font-black">First district admin</h2>
          <label className="admin-label mt-6" htmlFor="adminName">
            Full name
          </label>
          <input className="admin-input mt-2" id="adminName" name="adminName" required />
          <label className="admin-label mt-5" htmlFor="adminEmail">
            Work email
          </label>
          <input
            className="admin-input mt-2"
            id="adminEmail"
            name="adminEmail"
            type="email"
            autoComplete="email"
            required
          />
          <button className="admin-button mt-6 w-full" type="submit">
            Provision pilot and email invitation
          </button>
        </AdminCard>
      </form>
    </AdminPageFrame>
  );
}
