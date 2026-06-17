import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { RaiModel, ModelCardDoc, ModelCardMetadata } from "@/lib/services/responsible-ai-svc";

interface ModelCardProps {
  model: RaiModel;
  card: ModelCardDoc | null;
}

function Field({ label, value }: { label: string; value?: string | null }) {
  if (!value) return null;
  return (
    <div>
      <p className="text-xs uppercase tracking-wide text-aivo-ink-soft">{label}</p>
      <p className="mt-1 text-sm">{value}</p>
    </div>
  );
}

/**
 * Renders the model card metadata (NIST AI RMF GOVERN fields) plus the
 * markdown body as preformatted text. Falls back to the registry model's
 * intended/out-of-scope use when no card document is present.
 */
export function ModelCard({ model, card }: ModelCardProps) {
  const meta = (card?.metadata ?? {}) as ModelCardMetadata;
  const stakeholders: string[] | undefined = Array.isArray(meta.stakeholders)
    ? meta.stakeholders
    : undefined;

  return (
    <Card className="p-[var(--aivo-density-card-pad)]">
      <div className="flex items-center justify-between">
        <p className="font-display text-lg font-semibold">Model card</p>
        {meta.riskTier ? <Badge tone="warning">Risk tier: {meta.riskTier}</Badge> : null}
      </div>

      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <Field label="Accountable owner" value={meta.accountableOwner ?? model.owner?.contact} />
        <Field label="EU AI Act classification" value={meta.euAiActClassification} />
        <Field label="Intended use" value={meta.intendedUse ?? model.intendedUse} />
        <Field label="Out-of-scope use" value={meta.outOfScopeUse ?? model.outOfScopeUse} />
        <Field label="Human oversight" value={meta.humanOversight} />
        <Field label="Incident escalation" value={meta.incidentEscalation} />
        <Field label="Provenance" value={meta.provenance} />
        <Field label="Training data summary" value={meta.trainingDataSummary} />
        <Field label="Known limitations" value={meta.knownLimitations} />
        <Field label="Last reviewed" value={meta.lastReviewedAt} />
      </div>

      {stakeholders && stakeholders.length > 0 ? (
        <div className="mt-4">
          <p className="text-xs uppercase tracking-wide text-aivo-ink-soft">Stakeholders</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {stakeholders.map((s) => (
              <Badge key={s} tone="neutral">
                {s}
              </Badge>
            ))}
          </div>
        </div>
      ) : null}

      {card?.body ? (
        <div className="mt-6">
          <p className="text-xs uppercase tracking-wide text-aivo-ink-soft">Card document</p>
          <pre className="mt-2 whitespace-pre-wrap rounded-md bg-iw-raised p-4 text-sm text-iw-ink-muted">
            {String(card.body)}
          </pre>
        </div>
      ) : null}

      {!card ? (
        <p className="mt-4 text-sm text-aivo-ink-soft">
          No detailed model card document is on file. Showing registry metadata only.
        </p>
      ) : null}
    </Card>
  );
}
