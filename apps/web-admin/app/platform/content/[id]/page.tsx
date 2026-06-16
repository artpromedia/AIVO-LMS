import Link from "next/link";
import { requirePlatformPage } from "@aivo/admin-auth";
import { getContentPack } from "@aivo/admin-api/content";
import { AdminCard, AdminKpiCard, AdminPageFrame } from "@aivo/admin-ui";
import { formatDateTime } from "@/components/admin-format";

export default async function ContentPackDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await requirePlatformPage("platform:read");
  const { id } = await params;
  const pack = await getContentPack(session, id);

  return (
    <AdminPageFrame
      title={pack.title}
      description={`${pack.subject} · grade band ${pack.gradeBand} · v${pack.version}`}
      action={
        <Link className="admin-button admin-button-secondary" href="/platform/content">
          Back to packs
        </Link>
      }
    >
      <section className="mt-8 grid gap-4 md:grid-cols-3">
        <AdminKpiCard label="Activities" value={pack.activityCount} />
        <AdminCard className="p-5">
          <p className="text-sm font-semibold text-slate-500">Status</p>
          <p className="mt-2 text-2xl font-black">{pack.status}</p>
        </AdminCard>
        <AdminCard className="p-5">
          <p className="text-sm font-semibold text-slate-500">Validation</p>
          <p className="mt-2 text-2xl font-black">
            {pack.validation ? (pack.validation.ok ? "Passed" : `${pack.validation.issueCount} issues`) : "—"}
          </p>
          {pack.validation?.validatedAt ? (
            <p className="mt-1 text-sm text-slate-500">{formatDateTime(pack.validation.validatedAt)}</p>
          ) : null}
        </AdminCard>
      </section>

      <AdminCard className="mt-6 p-6">
        <dl className="grid gap-4 sm:grid-cols-2">
          <div>
            <dt className="text-sm font-semibold text-slate-500">Pack id</dt>
            <dd className="font-mono text-sm">{pack.id}</dd>
          </div>
          <div>
            <dt className="text-sm font-semibold text-slate-500">Last updated</dt>
            <dd className="text-sm font-bold">{formatDateTime(pack.updatedAt)}</dd>
          </div>
        </dl>
      </AdminCard>
    </AdminPageFrame>
  );
}
