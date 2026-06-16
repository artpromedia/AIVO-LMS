import Link from "next/link";
import { notFound } from "next/navigation";
import { requirePlatformPage } from "@aivo/admin-auth";
import { AdminApiError } from "@aivo/admin-api";
import { getAiModel } from "@aivo/admin-api/ai-governance";
import { AdminCard, AdminKpiCard, AdminPageFrame } from "@aivo/admin-ui";
import { formatDateTime } from "@/components/admin-format";

export default async function AiModelDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await requirePlatformPage("platform:read");
  const { id } = await params;

  let data: Awaited<ReturnType<typeof getAiModel>>;
  try {
    data = await getAiModel(session, id);
  } catch (error) {
    if (error instanceof AdminApiError && error.status === 404) notFound();
    throw error;
  }
  const { model, card, versions } = data;

  return (
    <AdminPageFrame
      title={model.name}
      description={`${model.provider} · ${model.modality} · status ${model.status}`}
      action={
        <Link className="admin-button admin-button-secondary" href="/platform/ai/models">
          Back to registry
        </Link>
      }
    >
      <section className="mt-8 grid gap-4 md:grid-cols-3">
        <AdminKpiCard label="Versions" value={versions.length} />
        <AdminCard className="p-5">
          <p className="text-sm font-semibold text-slate-500">Owner</p>
          <p className="mt-2 text-lg font-black">{model.owner.team}</p>
          <p className="text-sm text-slate-500">{model.owner.contact || "—"}</p>
        </AdminCard>
        <AdminCard className="p-5">
          <p className="text-sm font-semibold text-slate-500">Risk tier</p>
          <p className="mt-2 text-lg font-black uppercase">{card?.metadata.riskTier ?? "—"}</p>
        </AdminCard>
      </section>

      <AdminCard className="mt-6 p-6">
        <h2 className="text-xl font-black">Intended use</h2>
        <p className="mt-2 text-slate-600">{model.intendedUse || "—"}</p>
        <h2 className="mt-4 text-xl font-black">Out-of-scope use</h2>
        <p className="mt-2 text-slate-600">{model.outOfScopeUse || "—"}</p>
      </AdminCard>

      {card ? (
        <AdminCard className="mt-6 p-6">
          <h2 className="text-xl font-black">Model card</h2>
          <dl className="mt-4 grid gap-4 md:grid-cols-2">
            <div>
              <dt className="text-sm font-semibold text-slate-500">Accountable owner</dt>
              <dd className="text-slate-800">{card.metadata.accountableOwner || "—"}</dd>
            </div>
            <div>
              <dt className="text-sm font-semibold text-slate-500">EU AI Act classification</dt>
              <dd className="text-slate-800">{card.metadata.euAiActClassification || "—"}</dd>
            </div>
            <div>
              <dt className="text-sm font-semibold text-slate-500">Human oversight</dt>
              <dd className="text-slate-800">{card.metadata.humanOversight || "—"}</dd>
            </div>
            <div>
              <dt className="text-sm font-semibold text-slate-500">Incident escalation</dt>
              <dd className="text-slate-800">{card.metadata.incidentEscalation || "—"}</dd>
            </div>
            <div>
              <dt className="text-sm font-semibold text-slate-500">Provenance</dt>
              <dd className="text-slate-800">{card.metadata.provenance || "—"}</dd>
            </div>
            <div>
              <dt className="text-sm font-semibold text-slate-500">Last reviewed</dt>
              <dd className="text-slate-800">
                {card.metadata.lastReviewedAt
                  ? formatDateTime(card.metadata.lastReviewedAt)
                  : "—"}
              </dd>
            </div>
            <div>
              <dt className="text-sm font-semibold text-slate-500">Stakeholders</dt>
              <dd className="text-slate-800">
                {card.metadata.stakeholders.length > 0
                  ? card.metadata.stakeholders.join(", ")
                  : "—"}
              </dd>
            </div>
            <div>
              <dt className="text-sm font-semibold text-slate-500">Known limitations</dt>
              <dd className="text-slate-800">
                {card.metadata.knownLimitations.length > 0
                  ? card.metadata.knownLimitations.join(", ")
                  : "—"}
              </dd>
            </div>
          </dl>
          <h3 className="mt-6 text-sm font-semibold text-slate-500">Training data summary</h3>
          <p className="mt-1 text-slate-600">{card.metadata.trainingDataSummary || "—"}</p>
          {card.markdown ? (
            <pre className="mt-4 whitespace-pre-wrap rounded bg-slate-50 p-4 text-sm text-slate-700">
              {card.markdown}
            </pre>
          ) : null}
        </AdminCard>
      ) : (
        <AdminCard className="mt-6 p-6">
          <p className="text-slate-500">No model card published yet.</p>
        </AdminCard>
      )}

      <h2 className="mt-8 text-xl font-black">Versions</h2>
      <AdminCard className="mt-4 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Version</th>
                <th>Released</th>
                <th>Changelog</th>
                <th>Provenance</th>
              </tr>
            </thead>
            <tbody>
              {versions.map((version) => (
                <tr key={version.id}>
                  <td className="font-bold">{version.version}</td>
                  <td className="text-sm">{formatDateTime(version.releasedAt)}</td>
                  <td className="max-w-md truncate text-sm">{version.changelog || "—"}</td>
                  <td className="max-w-xs truncate text-sm text-slate-500">
                    {version.provenanceHash || "—"}
                  </td>
                </tr>
              ))}
              {versions.length === 0 ? (
                <tr>
                  <td className="py-10 text-center text-slate-500" colSpan={4}>
                    No versions recorded.
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
