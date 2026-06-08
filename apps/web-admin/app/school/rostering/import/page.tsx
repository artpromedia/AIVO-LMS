import Link from "next/link";
import { redirect } from "next/navigation";
import { requirePageRole } from "@aivo/admin-auth";
import { AdminApiError } from "@aivo/admin-api";
import { commitLearnerImport } from "@aivo/admin-api/rostering";
import { AdminCard, AdminPageFrame } from "@aivo/admin-ui";

/** Colocated server route that streams the auth-gated CSV template. */
const TEMPLATE_HREF = "/school/rostering/import/template";

const ROSTERING_ROLES = ["school_admin", "district_admin", "platform_admin"] as const;

function actionError(error: unknown): string {
  return error instanceof AdminApiError ? error.message : "Learner import failed.";
}

async function importAction(formData: FormData) {
  "use server";
  const session = await requirePageRole([...ROSTERING_ROLES]);
  const csvText = String(formData.get("csvText") || "").trim();
  if (!csvText) {
    redirect("/school/rostering/import?error=Paste%20CSV%20rows%20before%20importing.");
  }
  let jobId: string;
  try {
    const result = await commitLearnerImport(session, session.tenantId, csvText);
    jobId = result.jobId;
  } catch (error) {
    redirect(`/school/rostering/import?error=${encodeURIComponent(actionError(error))}`);
  }
  redirect(
    `/school/rostering?jobs=${encodeURIComponent(jobId)}&notice=${encodeURIComponent(
      "Import started.",
    )}`,
  );
}

export default async function SchoolRosteringImportPage({
  searchParams,
}: {
  searchParams: Promise<{ notice?: string; error?: string }>;
}) {
  await requirePageRole([...ROSTERING_ROLES]);
  const params = await searchParams;

  return (
    <AdminPageFrame
      eyebrow="School · Rostering"
      title="Import learners"
      description="Paste CSV roster rows to bulk-import learners. Download the template for the expected columns."
    >
      {params.notice ? <p className="admin-notice mt-5">{params.notice}</p> : null}
      {params.error ? <p className="admin-error mt-5">{params.error}</p> : null}

      <div className="mt-8 flex flex-wrap gap-2">
        <Link className="admin-button-secondary" href={TEMPLATE_HREF}>
          Download CSV template
        </Link>
        <Link className="admin-button-secondary" href="/school/rostering">
          Back to rostering
        </Link>
      </div>

      <AdminCard className="mt-6 p-6">
        <form action={importAction}>
          <label className="admin-label" htmlFor="csvText">
            CSV rows
          </label>
          <textarea
            className="admin-input mt-2"
            id="csvText"
            name="csvText"
            rows={14}
            placeholder="external_id,first_name,last_name,grade,..."
            required
          />
          <div className="mt-4">
            <button className="admin-button" type="submit">
              Start import
            </button>
          </div>
        </form>
      </AdminCard>
    </AdminPageFrame>
  );
}
