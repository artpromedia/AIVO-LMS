import Link from "next/link";
import { redirect } from "next/navigation";
import { requirePageRole } from "@aivo/admin-auth";
import { AdminApiError } from "@aivo/admin-api";
import {
  completeDistrictSetup,
  createDistrictSchool,
  getDistrictRosteringGrant,
  getDistrictSetupOverview,
  inviteDistrictAdmin,
  listDistrictLearners,
  setDistrictRosteringGrant,
  updateDistrictBranding,
} from "@aivo/admin-api/identity";
import { getDistrictPilotStatus } from "@aivo/admin-api/billing";
import {
  AdminCard,
  AdminKpiCard,
  AdminPageFrame,
  ChartCard,
  DonutBreakdown,
  Gauge,
} from "@aivo/admin-ui";
import type { DonutSlice } from "@aivo/admin-ui";
import { growthKpi } from "../platform/dashboard-data";

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

const EXPIRY_FORMAT = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
});

export default async function DistrictPage({
  searchParams,
}: {
  searchParams: Promise<{ notice?: string; error?: string }>;
}) {
  const session = await requirePageRole(["district_admin"]);
  const params = await searchParams;
  // One parallel round trip: the pilot read keys off the session tenant (the
  // district id), so nothing here depends on another read. Pilot and learner
  // failures are swallowed — the console still renders its setup/roster view.
  const [setup, rostering, pilot, learnerRows] = await Promise.all([
    getDistrictSetupOverview(session),
    getDistrictRosteringGrant(session),
    getDistrictPilotStatus(session, session.tenantId).catch(() => null),
    listDistrictLearners(session).catch(() => null),
  ]);

  const learnersKpi = learnerRows ? growthKpi(learnerRows) : null;
  const checklistDone = Object.values(setup.checklist).filter(Boolean).length;
  const checklistTotal = Object.keys(setup.checklist).length;

  const seatRatio =
    pilot && pilot.seatLimit && pilot.seatLimit > 0 ? pilot.seatsUsed / pilot.seatLimit : 0;
  const donutSlices: DonutSlice[] = [
    { label: "Staff", value: setup.counts.staff, tone: "primary" },
    { label: "Learners", value: setup.counts.learners, tone: "positive" },
    ...(pilot
      ? [{ label: "Parents", value: pilot.parentsOnboarded, tone: "warning" as const }]
      : []),
    ...(pilot
      ? [{ label: "Therapists", value: pilot.therapistsOnboarded, tone: "neutral" as const }]
      : []),
  ];

  return (
    <AdminPageFrame
      eyebrow="District administration"
      title={setup.district.name}
      description="Live district readiness and roster totals."
    >
      {params.notice ? <p className="admin-notice mt-8">{params.notice}</p> : null}
      {params.error ? <p className="admin-error mt-8">{params.error}</p> : null}

      {/* Row 1 — roster KPIs from the live setup overview. */}
      <section className="mt-8 grid gap-4 md:grid-cols-3">
        <AdminKpiCard label="Schools" testId="district-kpi-schools" value={setup.counts.schools} />
        <AdminKpiCard label="Staff" testId="district-kpi-staff" value={setup.counts.staff} />
        <AdminKpiCard
          label="Learners"
          testId="district-kpi-learners"
          value={setup.counts.learners}
          delta={learnersKpi?.delta}
          deltaCaption="in the last 7 days"
          trend={learnersKpi?.trend}
        />
      </section>

      {/* Row 2 — pilot seat usage + roster composition. */}
      <section className="mt-6 grid gap-6 lg:grid-cols-2">
        {pilot ? (
          <ChartCard
            testId="district-seat-gauge"
            title="Seat usage"
            subtitle={[
              pilot.seatLimit != null
                ? `${(pilot.seatsRemaining ?? 0).toLocaleString("en-US")} seats remaining`
                : "Uncapped pilot",
              pilot.expiresAt ? `Expires ${EXPIRY_FORMAT.format(new Date(pilot.expiresAt))}` : null,
            ]
              .filter(Boolean)
              .join(" · ")}
            aspect={16 / 10}
            srRows={[
              {
                "seats used": pilot.seatsUsed,
                "seat limit": pilot.seatLimit ?? "uncapped",
                "seats remaining": pilot.seatsRemaining ?? "uncapped",
              },
            ]}
          >
            <Gauge
              ratio={seatRatio}
              title="Pilot seat usage"
              description={`${pilot.seatsUsed} of ${pilot.seatLimit ?? "uncapped"} pilot seats in use`}
              label={
                pilot.seatLimit != null
                  ? `${pilot.seatsUsed.toLocaleString("en-US")}/${pilot.seatLimit.toLocaleString("en-US")}`
                  : pilot.seatsUsed.toLocaleString("en-US")
              }
              caption="seats used"
            />
          </ChartCard>
        ) : (
          <AdminCard className="p-6" testId="district-seat-gauge">
            <h3 className="admin-h2">Seat usage</h3>
            <p className="mt-2 text-sm text-slate-600">
              No active pilot subscription. Seat usage appears here once your district is
              provisioned.
            </p>
          </AdminCard>
        )}
        <ChartCard
          testId="district-roster-mix"
          title="Roster composition"
          subtitle="Staff, learners, and onboarded parents in your district."
          aspect={16 / 10}
          srRows={donutSlices.map((slice) => ({ group: slice.label, people: slice.value }))}
        >
          <DonutBreakdown
            data={donutSlices}
            title="Roster composition"
            description="District roster broken down by staff, learners, and parents"
            totalLabel="people"
          />
        </ChartCard>
      </section>

      {/* First-run setup — single progress widget; the quick-action server
          actions (addSchool / inviteAdmin / saveSupportContact /
          completeSetup) are unchanged. */}
      {!setup.setupComplete ? (
        <AdminCard className="mt-6 p-6" testId="district-setup">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="admin-step">First-run setup</p>
              <h2 className="admin-h2 mt-3 text-2xl">Prepare your district</h2>
              <p className="mt-2 text-slate-600">
                Complete the operational checklist. At least one school is required before setup can
                be closed.
              </p>
            </div>
            <p
              className="rounded-xl bg-blue-50 px-4 py-2 text-sm font-bold text-blue-800"
              data-testid="district-setup-progress"
            >
              {checklistDone} of {checklistTotal} ready
            </p>
          </div>

          <div
            className="mt-4 h-2 w-full rounded-full"
            style={{ background: "var(--admin-chart-grid)" }}
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={checklistTotal}
            aria-valuenow={checklistDone}
            aria-label="District setup progress"
          >
            <div
              className="h-2 rounded-full"
              style={{
                width: `${Math.round((checklistDone / checklistTotal) * 100)}%`,
                background: "var(--admin-chart-1)",
              }}
            />
          </div>
          <ul className="mt-4 grid gap-2 md:grid-cols-2">
            {Object.entries(checklistCopy).map(([key, copy]) => {
              const complete = setup.checklist[key as keyof typeof setup.checklist];
              return (
                <li className="flex items-baseline gap-2 text-sm" key={key}>
                  <span
                    className={`font-bold uppercase ${complete ? "text-emerald-700" : "text-slate-400"}`}
                  >
                    {complete ? "Done" : "Next"}
                  </span>
                  <span className="font-semibold text-slate-700">{copy[0]}</span>
                </li>
              );
            })}
          </ul>

          <div className="mt-6 grid gap-4 lg:grid-cols-3">
            <form action={addSchool} className="admin-quick-action">
              <h3 className="font-semibold">Add first school</h3>
              <input className="admin-input mt-3" name="name" placeholder="School name" required />
              <button className="admin-action mt-3" type="submit">
                Add school
              </button>
            </form>
            <form action={inviteAdmin} className="admin-quick-action">
              <h3 className="font-semibold">Invite district admin</h3>
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
              <h3 className="font-semibold">Set support contact</h3>
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
          <div className="mt-6 flex flex-wrap items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4">
            <div className="flex-1">
              <h3 className="font-semibold">Invite parents into your district</h3>
              <p className="text-sm text-slate-500">
                Single or bulk CSV. Parents set their own password; their accounts live under your
                district (no self-serve B2C tenant).
              </p>
            </div>
            <Link className="admin-button" href="/district/parents">
              Invite parents
            </Link>
          </div>
          <form action={completeSetup} className="mt-6">
            <button className="admin-button" disabled={!setup.canComplete} type="submit">
              Mark district setup complete
            </button>
          </form>
        </AdminCard>
      ) : (
        <AdminCard className="mt-6 p-6" testId="district-setup-complete">
          <p className="admin-step text-emerald-700">Setup complete</p>
          <h2 className="admin-h2 mt-3 text-2xl">District operations are ready</h2>
          <p className="mt-2 text-slate-600">
            The first-run checklist is closed. Live roster totals remain visible above.
          </p>
        </AdminCard>
      )}

      <AdminCard className="mt-6 p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="max-w-2xl">
            <p className="admin-step">Teacher permissions</p>
            <h2 className="admin-h2 mt-3 text-2xl">Teacher-managed rostering</h2>
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
