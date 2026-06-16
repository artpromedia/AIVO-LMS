import Link from "next/link";
import { requirePlatformPage } from "@aivo/admin-auth";
import { getModerationStats } from "@aivo/admin-api/moderation";
import { AdminCard, AdminKpiCard, AdminPageFrame } from "@aivo/admin-ui";

export default async function SafetyPage() {
  const session = await requirePlatformPage("platform:read");
  const stats = await getModerationStats(session);
  const total = stats.byStatus.reduce((sum, row) => sum + row.count, 0);
  const pending = stats.byStatus.find((row) => row.status.toUpperCase() === "PENDING")?.count ?? 0;

  return (
    <AdminPageFrame
      title="Safety"
      description="Trust & safety operations for AI-generated learner content."
    >
      <section className="mt-8 grid gap-4 md:grid-cols-2">
        <AdminKpiCard label="Flagged total" value={total} />
        <AdminKpiCard label="Pending review" value={pending} />
      </section>

      <AdminCard className="mt-6 p-6">
        <h2 className="text-xl font-black">Moderation queue</h2>
        <p className="mt-2 max-w-3xl text-slate-600">
          Review AI tutor content flagged by automated safety classifiers and record approve, reject,
          or escalate decisions with a full audit trail.
        </p>
        <Link className="mt-4 inline-flex font-bold text-violet-700 hover:text-violet-800" href="/platform/safety/moderation">
          Open moderation queue
        </Link>
      </AdminCard>
    </AdminPageFrame>
  );
}
