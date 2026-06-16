import { requirePlatformPage } from "@aivo/admin-auth";
import { listAdminLearnersPage } from "@aivo/admin-api/platform";
import { AdminPageFrame, DataTable } from "@aivo/admin-ui";
import { formatDateTime } from "@/components/admin-format";

const PAGE_SIZE = 50;

export default async function PlatformLearnersPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; q?: string }>;
}) {
  const session = await requirePlatformPage("platform:read");
  const params = await searchParams;
  const page = Math.max(1, Number(params.page) || 1);
  const search = params.q?.trim() || undefined;
  const result = await listAdminLearnersPage(session, { page, pageSize: PAGE_SIZE, search });

  return (
    <AdminPageFrame
      title="Learners"
      description={`${result.total.toLocaleString()} learner profiles across all tenants.`}
    >
      <div className="mt-8">
        <DataTable
          basePath="/platform/learners"
          rows={result.rows}
          rowKey={(row) => row.id}
          total={result.total}
          page={result.page}
          pageSize={result.pageSize}
          search={search}
          exportHref={`/platform/learners/export${search ? `?q=${encodeURIComponent(search)}` : ""}`}
          emptyMessage="No learners match."
          searchPlaceholder="Search learner name…"
          columns={[
            { key: "learner", header: "Learner", render: (row) => <span className="font-semibold">{row.name}</span> },
            { key: "grade", header: "Grade", render: (row) => row.gradeLevel ?? "—" },
            { key: "tenant", header: "Tenant", render: (row) => row.tenantId ?? "—" },
            { key: "created", header: "Created", render: (row) => formatDateTime(row.createdAt) },
          ]}
        />
      </div>
    </AdminPageFrame>
  );
}
