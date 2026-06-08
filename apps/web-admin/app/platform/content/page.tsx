import { requirePlatformPage } from "@aivo/admin-auth";
import { listContentPacks } from "@aivo/admin-api/content";
import { AdminCard, AdminPageFrame } from "@aivo/admin-ui";
import { formatDateTime } from "@/components/admin-format";

export default async function ContentPacksPage() {
  const session = await requirePlatformPage("platform:read");
  const packs = await listContentPacks(session);

  return (
    <AdminPageFrame
      eyebrow="Platform"
      title="Content packs"
      description="Sealed, versioned activity bundles for cold-start, offline, and budget-capped delivery."
    >
      <AdminCard className="mt-6 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Pack</th>
                <th>Subject</th>
                <th>Grade band</th>
                <th>Version</th>
                <th>Status</th>
                <th>Validation</th>
                <th>Updated</th>
              </tr>
            </thead>
            <tbody>
              {packs.map((pack) => (
                <tr key={pack.id}>
                  <td className="font-bold">
                    <a className="text-blue-700" href={`/platform/content/${pack.id}`}>
                      {pack.title}
                    </a>
                  </td>
                  <td>{pack.subject}</td>
                  <td>{pack.gradeBand}</td>
                  <td className="text-sm">{pack.version}</td>
                  <td>
                    <span className="admin-status">{pack.status}</span>
                  </td>
                  <td className="text-sm">
                    {pack.validation
                      ? pack.validation.ok
                        ? "Passed"
                        : `${pack.validation.issueCount} issues`
                      : "—"}
                  </td>
                  <td className="text-sm">{formatDateTime(pack.updatedAt)}</td>
                </tr>
              ))}
              {packs.length === 0 ? (
                <tr>
                  <td className="py-10 text-center text-slate-500" colSpan={7}>
                    No content packs registered.
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
