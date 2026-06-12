"use client";

/**
 * Parent approval panel for profile recommendations (adaptive-learning E2E
 * Sprint 5). Lists PENDING recommendations from
 * /api/bff/learners/:id/recommendations with evidence provenance and a
 * from → to summary; Approve / Adjust / Decline post to the respond route
 * and re-render the decided state inline (no reload). Recent decided
 * history renders below so parents can see what they already actioned.
 */
import * as React from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { bffFetch } from "@/lib/api/client";
import { toast } from "@/lib/use-toast";
import { useTranslations } from "next-intl";
import { CheckCircle2, ShieldQuestion, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

interface Evidence {
  source: string;
  summary: string;
  contributorRole?: string;
}

export interface PanelRecommendation {
  id: string;
  type: string;
  title: string;
  parentSummary: string;
  currentValue: unknown;
  proposedValue: unknown;
  evidence: Evidence[];
  status: string;
  declineReason?: string;
  createdAt: string;
}

function valueLabel(value: unknown): string {
  if (value == null) return "—";
  if (typeof value === "object") {
    const v = value as Record<string, unknown>;
    if ("from" in v && "to" in v) {
      const range = `${String(v.from)} → ${String(v.to)}`;
      // Wave C (G1): subject-scoped proposals name the subject so a parent
      // knows exactly which band moves (e.g. "math: 2 → 3").
      return typeof v.subjectKey === "string" && v.subjectKey.length > 0
        ? `${v.subjectKey}: ${range}`
        : range;
    }
    if ("reason" in v) return String(v.reason);
    return JSON.stringify(v);
  }
  return String(value);
}

function evidenceSummary(evidence: Evidence[]): string {
  const counts = new Map<string, number>();
  for (const e of evidence) {
    const key = e.contributorRole ? `${e.contributorRole} observation` : `${e.source} signal`;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return Array.from(counts.entries())
    .map(([label, n]) => `${n} ${label}${n > 1 ? "s" : ""}`)
    .join(" + ");
}

type Decision = { state: "deciding" } | { state: "decided"; status: string } | null;

function RecommendationCard({
  apiBase,
  rec,
  onDecided,
}: {
  apiBase: string;
  rec: PanelRecommendation;
  onDecided: (id: string, status: string) => void;
}) {
  const t = useTranslations("parent.recommendations");
  const [decision, setDecision] = React.useState<Decision>(null);
  const [mode, setMode] = React.useState<"none" | "amend" | "decline">("none");
  const [amendValue, setAmendValue] = React.useState("");
  const [declineReason, setDeclineReason] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);

  const respondMutation = useMutation({
    mutationFn: (action: "accept" | "amend" | "decline") =>
      bffFetch<{ recommendation: { status: string } }>(`${apiBase}/${rec.id}/respond`, {
        method: "POST",
        body: {
          action,
          ...(action === "amend" ? { amendedValue: amendValue } : {}),
          ...(action === "decline" ? { declineReason } : {}),
        },
      }),
    onMutate: () => {
      setDecision({ state: "deciding" });
      setError(null);
    },
    onSuccess: (data) => {
      const status = String(data.recommendation.status);
      setDecision({ state: "decided", status });
      onDecided(rec.id, status);
    },
    onError: (_e, action) => {
      setDecision(null);
      setError(t("decision_error"));
      toast({
        title: t("decision_error"),
        variant: "danger",
        action: { label: t("retry"), onClick: () => respondMutation.mutate(action) },
      });
    },
  });

  function respond(action: "accept" | "amend" | "decline") {
    respondMutation.mutate(action);
  }

  if (decision?.state === "decided") {
    const applied = decision.status === "APPLIED";
    const declined = decision.status === "DECLINED";
    return (
      <div className="rounded-lg border border-aivo-line/60 p-4" data-testid="decided-card">
        <div className="flex items-center gap-2">
          {applied ? (
            <CheckCircle2 className="h-5 w-5 text-emerald-500" aria-hidden />
          ) : declined ? (
            <XCircle className="h-5 w-5 text-aivo-ink-soft" aria-hidden />
          ) : (
            <ShieldQuestion className="h-5 w-5 text-amber-500" aria-hidden />
          )}
          <p className="font-medium">{rec.title}</p>
        </div>
        <p className="mt-1 text-sm text-aivo-ink-soft">
          {applied ? t("status_applied") : declined ? t("status_declined") : t("status_failed")}
        </p>
      </div>
    );
  }

  const busy = decision?.state === "deciding";
  return (
    <div className="rounded-lg border border-aivo-line/60 p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <p className="font-medium">{rec.title}</p>
        <Badge tone="primary">{t("pending_badge")}</Badge>
      </div>
      <p className="mt-1 text-sm text-aivo-ink-soft">{rec.parentSummary}</p>
      <p className="mt-2 text-sm">
        <span className="text-aivo-ink-soft">{t("proposed_change")}: </span>
        <strong>{valueLabel(rec.proposedValue)}</strong>
      </p>
      {rec.evidence.length > 0 ? (
        <p className="mt-1 text-xs text-aivo-ink-soft">
          {t("based_on", { summary: evidenceSummary(rec.evidence) })}
        </p>
      ) : null}

      {mode === "amend" ? (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <label className="text-sm" htmlFor={`amend-${rec.id}`}>
            {t("amend_label")}
          </label>
          <input
            id={`amend-${rec.id}`}
            className="rounded-md border border-aivo-line px-2 py-1 text-sm"
            value={amendValue}
            onChange={(e) => setAmendValue(e.target.value)}
          />
          <Button size="sm" disabled={busy || amendValue.trim() === ""} onClick={() => respond("amend")}>
            {t("confirm_adjust")}
          </Button>
          <Button size="sm" variant="ghost" disabled={busy} onClick={() => setMode("none")}>
            {t("cancel")}
          </Button>
        </div>
      ) : mode === "decline" ? (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <label className="text-sm" htmlFor={`decline-${rec.id}`}>
            {t("decline_reason_label")}
          </label>
          <input
            id={`decline-${rec.id}`}
            className="rounded-md border border-aivo-line px-2 py-1 text-sm"
            value={declineReason}
            onChange={(e) => setDeclineReason(e.target.value)}
          />
          <Button
            size="sm"
            variant="outline"
            disabled={busy || declineReason.trim() === ""}
            onClick={() => respond("decline")}
          >
            {t("confirm_decline")}
          </Button>
          <Button size="sm" variant="ghost" disabled={busy} onClick={() => setMode("none")}>
            {t("cancel")}
          </Button>
        </div>
      ) : (
        <div className="mt-3 flex flex-wrap gap-2">
          <Button size="sm" disabled={busy} onClick={() => respond("accept")} aria-busy={busy}>
            {t("approve")}
          </Button>
          <Button size="sm" variant="outline" disabled={busy} onClick={() => setMode("amend")}>
            {t("adjust")}
          </Button>
          <Button size="sm" variant="ghost" disabled={busy} onClick={() => setMode("decline")}>
            {t("decline")}
          </Button>
        </div>
      )}
      {error ? (
        <p role="alert" className="mt-2 text-sm text-aivo-danger">
          {error}
        </p>
      ) : null}
    </div>
  );
}

export function PendingRecommendationsPanel({
  learnerId,
  apiBase: apiBaseProp,
}: {
  learnerId: string;
  /**
   * Wave C (G5): role-scoped endpoint base. Defaults to the parent route;
   * the teacher/caregiver surfaces pass their own BFF base so the same
   * panel drives every approver role (the service enforces the per-tenant
   * delegation policy and 403s out-of-policy decisions).
   */
  apiBase?: string;
}) {
  const apiBase = apiBaseProp ?? `/api/bff/learners/${learnerId}/recommendations`;
  const t = useTranslations("parent.recommendations");
  const queryClient = useQueryClient();
  const listQuery = useQuery({
    queryKey: ["recommendations", apiBase],
    queryFn: () =>
      bffFetch<{ pending?: PanelRecommendation[]; decided?: PanelRecommendation[] }>(apiBase),
  });
  const loading = listQuery.isPending;
  const error = listQuery.isError ? t("load_error") : null;
  const pending = listQuery.data?.pending ?? [];
  const [decidedLocal, setDecidedLocal] = React.useState<PanelRecommendation[]>([]);
  const decided = React.useMemo(
    () => [...decidedLocal, ...(listQuery.data?.decided ?? [])].slice(0, 10),
    [decidedLocal, listQuery.data?.decided],
  );

  const onDecided = React.useCallback(
    (id: string, status: string) => {
      // The card renders its own decided state inline; keep the list as-is so
      // the parent sees the outcome where they acted, and update history.
      const moved = pending.find((rec) => rec.id === id);
      if (moved) setDecidedLocal((prev) => [{ ...moved, status }, ...prev].slice(0, 10));
      // Refresh in the background so the server's view wins on next visit.
      void queryClient.invalidateQueries({ queryKey: ["recommendations", apiBase] });
    },
    [pending, queryClient, apiBase],
  );

  return (
    <div className="flex flex-col gap-3" id="recommendations">
      {loading ? (
        <p className="text-sm text-aivo-ink-soft">{t("loading")}</p>
      ) : error ? (
        <p role="alert" className="text-sm text-aivo-danger">
          {error}
        </p>
      ) : pending.length === 0 ? (
        <p className="text-sm text-aivo-ink-soft">{t("empty")}</p>
      ) : (
        pending.map((rec) => (
          <RecommendationCard key={rec.id} apiBase={apiBase} rec={rec} onDecided={onDecided} />
        ))
      )}
      {!loading && decided.length > 0 ? (
        <details className="text-sm text-aivo-ink-soft">
          <summary className="cursor-pointer">{t("history", { count: decided.length })}</summary>
          <ul className="mt-2 grid gap-1">
            {decided.map((d) => (
              <li key={d.id} className="flex items-center justify-between gap-2">
                <span className="truncate">{d.title}</span>
                <span>{d.status}</span>
              </li>
            ))}
          </ul>
        </details>
      ) : null}
    </div>
  );
}
