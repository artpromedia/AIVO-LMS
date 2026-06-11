/**
 * Wave A (G2) — the honest baseline-provenance badge.
 *
 * Pure presentational: the page resolves the provenance via
 * `baselineProvenance(metadata)` (lib/learner/baseline-provenance.ts) and
 * passes the translated label + tone in, so this renders identically from
 * server and client components and the classification logic stays in one
 * unit-tested module.
 */
import * as React from "react";
import { Sparkles, Layers, Leaf } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { BaselinePersonalization } from "@/lib/db/types";

const ICONS: Record<BaselinePersonalization, typeof Sparkles> = {
  child_specific: Sparkles,
  cohort_bank: Layers,
  generic: Leaf,
};

export function BaselineProvenanceBadge({
  personalization,
  tone,
  label,
}: {
  personalization: BaselinePersonalization;
  tone: "primary" | "neutral";
  label: string;
}) {
  const Icon = ICONS[personalization];
  return (
    <Badge tone={tone} data-testid="baseline-provenance-badge" data-provenance={personalization}>
      <Icon className="mr-1 h-3 w-3" aria-hidden />
      {label}
    </Badge>
  );
}
