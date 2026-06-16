import Link from "next/link";
import { requirePlatformPage } from "@aivo/admin-auth";
import { listAiModels } from "@aivo/admin-api/ai-governance";
import { AdminCard, AdminKpiCard, AdminPageFrame } from "@aivo/admin-ui";
import { formatDateTime } from "@/components/admin-format";
import { StatusPill } from "@/components/status-pill";

export default async function AiModelsPage() {
  const session = await requirePlatformPage("platform:read");
  const models = await listAiModels(session);

  const active = models.filter((m) => m.status === "active").length;
  const retired = models.filter((m) => m.status === "retired").length;

  return (
    <AdminPageFrame
      title="Model registry"
      description="Every model in use with provider, modality and governance status."
      action={
        <Link className="admin-button admin-button-secondary" href="/platform/ai/evals">
          Eval runs
        </Link>
      }
    >
      <section className="mt-8 grid gap-4 md:grid-cols-3">
        <AdminKpiCard label="Models" value={models.length} />
        <AdminKpiCard label="Active" value={active} />
        <AdminKpiCard label="Retired" value={retired} />
      </section>

      <AdminCard className="mt-6 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Model</th>
                <th>Provider</th>
                <th>Modality</th>
                <th>Status</th>
                <th>Owner</th>
                <th>Versions</th>
                <th>Updated</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {models.map((model) => (
                <tr key={model.id}>
                  <td className="font-bold">{model.name}</td>
                  <td className="text-sm">{model.provider}</td>
                  <td className="text-sm">{model.modality}</td>
                  <td>
                    <StatusPill status={model.status} />
                  </td>
                  <td className="text-sm">{model.owner.team}</td>
                  <td className="text-sm tabular-nums">{model.versions}</td>
                  <td className="text-sm tabular-nums">{formatDateTime(model.updatedAt)}</td>
                  <td>
                    <Link
                      className="inline-flex font-bold text-violet-700 hover:text-violet-800"
                      href={`/platform/ai/models/${model.id}`}
                    >
                      View
                    </Link>
                  </td>
                </tr>
              ))}
              {models.length === 0 ? (
                <tr>
                  <td className="py-10 text-center text-slate-500" colSpan={8}>
                    No models registered.
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
