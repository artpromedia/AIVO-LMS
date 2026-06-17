import Link from "next/link";
import { redirect } from "next/navigation";
import { requirePageRole } from "@aivo/admin-auth";
import { AdminApiError } from "@aivo/admin-api";
import { createPlatformDistrict } from "@aivo/admin-api/identity";
import { AdminCard, AdminPageFrame } from "@aivo/admin-ui";

function errorMessage(error: unknown): string {
  return error instanceof AdminApiError ? error.message : "District onboarding failed.";
}

async function onboardDistrict(formData: FormData) {
  "use server";
  const session = await requirePageRole(["platform_admin"]);
  const districtName = String(formData.get("districtName") || "").trim();
  const adminName = String(formData.get("adminName") || "").trim();
  const adminEmail = String(formData.get("adminEmail") || "")
    .trim()
    .toLowerCase();
  if (!districtName || !adminName || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(adminEmail)) {
    redirect(
      "/platform/districts/new?error=Enter%20a%20district%20name%2C%20admin%20name%2C%20and%20valid%20email.",
    );
  }

  let result;
  try {
    result = await createPlatformDistrict(session, { districtName, adminName, adminEmail });
  } catch (error) {
    redirect(`/platform/districts/new?error=${encodeURIComponent(errorMessage(error))}`);
  }
  const query = new URLSearchParams({
    created: result.district.name,
    email: result.invite.email,
  });
  if (result.invite.inviteUrl) query.set("inviteUrl", result.invite.inviteUrl);
  redirect(`/platform/districts/new?${query.toString()}`);
}

export default async function NewDistrictPage({
  searchParams,
}: {
  searchParams: Promise<{ created?: string; email?: string; inviteUrl?: string; error?: string }>;
}) {
  await requirePageRole(["platform_admin"]);
  const params = await searchParams;

  return (
    <AdminPageFrame
      title="Onboard a district"
      description="Create the district tenant and email a secure, single-use invitation to its first administrator."
      action={
        <div className="flex flex-wrap gap-2">
          <Link className="admin-button" href="/platform/pilots/new">
            Provision pilot (with entitlement)
          </Link>
          <Link className="admin-button admin-button-secondary" href="/platform/districts">
            Manage invitations
          </Link>
        </div>
      }
    >
      {params.created && params.email ? (
        <AdminCard className="mt-8 border-emerald-200 p-6">
          <p className="text-sm font-bold uppercase tracking-[0.2em] text-emerald-700">
            Invitation sent
          </p>
          <h2 className="mt-3 text-2xl font-black">{params.created} is ready for setup</h2>
          <p className="mt-2 text-slate-600">
            A secure invitation was emailed to {params.email}. No temporary password was created or
            shown.
          </p>
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

      <form action={onboardDistrict} className="mt-8 grid gap-6 lg:grid-cols-2">
        <AdminCard className="p-6">
          <p className="admin-step">Step 1</p>
          <h2 className="mt-3 text-2xl font-black">District details</h2>
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
          <p className="mt-3 text-sm text-slate-500">
            This creates an isolated B2B district tenant with setup marked incomplete.
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
            Create district and email invitation
          </button>
        </AdminCard>
      </form>
    </AdminPageFrame>
  );
}
