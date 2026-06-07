import { redirect } from "next/navigation";
import { requirePageRole } from "@aivo/admin-auth";
import { AdminApiError } from "@aivo/admin-api";
import {
  completeDistrictSetup,
  createDistrictSchool,
  getDistrictRosteringGrant,
  getDistrictSetupOverview,
  inviteDistrictAdmin,
  setDistrictRosteringGrant,
  updateDistrictBranding,
} from "@aivo/admin-api/identity";
import { AdminCard, AdminMetricCard, AdminPageFrame } from "@aivo/admin-ui";

async function completeSetup() {
  "use server";
  const session = await requirePageRole(["district_admin"]);
  try {
    await completeDistrictSetup(session);
  } catch (error) {
    const message = error instanceof AdminApiError ? error.message : "Unable to complete setup.";
    redirect(`/district?error=${encodeURIComponent(message)}`);
  }
  redirect("/district?notice=District%20setup%20completed.");
}

function messageFor(error: unknown): string {
  return error instanceof AdminApiError ? error.message : "Setup action failed.";
}

async function addSchool(formData: FormData) {
  "use server";
  const session = await requirePageRole(["district_admin"]);
  const name = String(formData.get("name") || "").trim();
  if (!name) redirect("/district?error=School%20name%20is%20required.");
  try {
    await createDistrictSchool(session, { name });
  } catch (error) {
    redirect(`/district?error=${encodeURIComponent(messageFor(error))}`);
  }
  redirect("/district?notice=School%20added.");
}

async function inviteAdmin(formData: FormData) {
  "use server";
  const session = await requirePageRole(["district_admin"]);
  const name = String(formData.get("name") || "").trim();
  const email = String(formData.get("email") || "")
    .trim()
    .toLowerCase();
  if (!name || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    redirect("/district?error=Enter%20an%20admin%20name%20and%20valid%20email.");
  }
  try {
    await inviteDistrictAdmin(session, { name, email });
  } catch (error) {
    redirect(`/district?error=${encodeURIComponent(messageFor(error))}`);
  }
  redirect("/district?notice=District%20admin%20invitation%20sent.");
}

async function saveSupportContact(formData: FormData) {
  "use server";
  const session = await requirePageRole(["district_admin"]);
  const supportEmail = String(formData.get("supportEmail") || "")
    .trim()
    .toLowerCase();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(supportEmail)) {
    redirect("/district?error=Enter%20a%20valid%20support%20email.");
  }
  try {
    await updateDistrictBranding(session, { supportEmail });
  } catch (error) {
    redirect(`/district?error=${encodeURIComponent(messageFor(error))}`);
  }
  redirect("/district?notice=Support%20contact%20saved.");
}

async function setRosteringGrant(formData: FormData) {
  "use server";
  const session = await requirePageRole(["district_admin"]);
  const enabled = String(formData.get("enabled") || "") === "true";
  try {
    await setDistrictRosteringGrant(session, enabled);
  } catch (error) {
    redirect(`/district?error=${encodeURIComponent(messageFor(error))}`);
  }
  redirect(
    enabled
      ? "/district?notice=Teachers%20can%20now%20connect%20rosters."
      : "/district?notice=Teacher%20roster%20connections%20disabled.",
  );
}

const checklistCopy = {
  schools: ["Add at least one school", "Schools establish the district roster boundary."],
  staff: ["Invite school admins or staff", "Delegate setup and day-to-day operations."],
  branding: [
    "Set branding and support contact",
    "Give families a recognizable, supported experience.",
  ],
  sso: ["Confirm SSO and SCIM approach", "Enable identity automation when your district is ready."],
} as const;

export default async function DistrictPage({
  searchParams,
}: {
  searchParams: Promise<{ notice?: string; error?: string }>;
}) {
  const session = await requirePageRole(["district_admin"]);
  const params = await searchParams;
  const setup = await getDistrictSetupOverview(session);
  const rostering = await getDistrictRosteringGrant(session);

  return (
    <AdminPageFrame
      eyebrow="District administration"
      title={setup.district.name}
      description="Live district readiness and roster totals."
    >
      {params.notice ? <p className="admin-notice mt-8">{params.notice}</p> : null}
      {params.error ? <p className="admin-error mt-8">{params.error}</p> : null}

      <section className="mt-8 grid gap-4 md:grid-cols-3">
        <AdminMetricCard label="Schools" value={setup.counts.schools} />
        <AdminMetricCard label="Staff" value={setup.counts.staff} />
        <AdminMetricCard label="Learners" value={setup.counts.learners} />
      </section>

      {!setup.setupComplete ? (
        <AdminCard className="mt-6 p-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="admin-step">First-run setup</p>
              <h2 className="mt-3 text-2xl font-black">Prepare your district</h2>
              <p className="mt-2 text-slate-600">
                Complete the operational checklist. At least one school is required before setup can
                be closed.
              </p>
            </div>
            <p className="rounded-full bg-blue-50 px-4 py-2 text-sm font-bold text-blue-800">
              {Object.values(setup.checklist).filter(Boolean).length} of 4 ready
            </p>
          </div>
          <div className="mt-6 grid gap-3 md:grid-cols-2">
            {Object.entries(checklistCopy).map(([key, copy]) => {
              const complete = setup.checklist[key as keyof typeof setup.checklist];
              return (
                <article
                  className={`admin-checklist ${complete ? "admin-checklist-complete" : ""}`}
                  key={key}
                >
                  <span className="admin-checkmark">{complete ? "Done" : "Next"}</span>
                  <h3 className="mt-3 font-black">{copy[0]}</h3>
                  <p className="mt-1 text-sm text-slate-600">{copy[1]}</p>
                </article>
              );
            })}
          </div>
          <div className="mt-6 grid gap-4 lg:grid-cols-3">
            <form action={addSchool} className="admin-quick-action">
              <h3 className="font-black">Add first school</h3>
              <input className="admin-input mt-3" name="name" placeholder="School name" required />
              <button className="admin-action mt-3" type="submit">
                Add school
              </button>
            </form>
            <form action={inviteAdmin} className="admin-quick-action">
              <h3 className="font-black">Invite district admin</h3>
              <input className="admin-input mt-3" name="name" placeholder="Full name" required />
              <input
                className="admin-input mt-2"
                name="email"
                placeholder="Work email"
                type="email"
                required
              />
              <button className="admin-action mt-3" type="submit">
                Send invitation
              </button>
            </form>
            <form action={saveSupportContact} className="admin-quick-action">
              <h3 className="font-black">Set support contact</h3>
              <input
                className="admin-input mt-3"
                name="supportEmail"
                placeholder="support@district.org"
                type="email"
                required
              />
              <button className="admin-action mt-3" type="submit">
                Save contact
              </button>
            </form>
          </div>
          <form action={completeSetup} className="mt-6">
            <button className="admin-button" disabled={!setup.canComplete} type="submit">
              Mark district setup complete
            </button>
          </form>
        </AdminCard>
      ) : (
        <AdminCard className="mt-6 p-6">
          <p className="admin-step text-emerald-700">Setup complete</p>
          <h2 className="mt-3 text-2xl font-black">District operations are ready</h2>
          <p className="mt-2 text-slate-600">
            The first-run checklist is closed. Live roster totals remain visible above.
          </p>
        </AdminCard>
      )}

      <AdminCard className="mt-6 p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="max-w-2xl">
            <p className="admin-step">Teacher permissions</p>
            <h2 className="mt-3 text-2xl font-black">Teacher-managed rostering</h2>
            <p className="mt-2 text-slate-600">
              When enabled, teachers can connect and sync their own roster sources (Google
              Classroom, Clever, ClassLink, OneRoster) from the learner app. When disabled, only
              district and school admins manage rostering.
            </p>
            <p className="mt-2 text-sm font-bold">
              Status:{" "}
              {rostering.teacherRosteringEnabled ? (
                <span className="text-emerald-700">Teachers can connect rosters</span>
              ) : (
                <span className="text-slate-600">Teachers cannot connect rosters</span>
              )}
            </p>
          </div>
          <form action={setRosteringGrant}>
            <input
              type="hidden"
              name="enabled"
              value={rostering.teacherRosteringEnabled ? "false" : "true"}
            />
            <button className="admin-button" type="submit">
              {rostering.teacherRosteringEnabled ? "Disable for teachers" : "Enable for teachers"}
            </button>
          </form>
        </div>
      </AdminCard>
    </AdminPageFrame>
  );
}
