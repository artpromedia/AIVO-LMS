"use client";

import { useState } from "react";
import {
  RecommendationEvidenceCard,
  type RecommendationEvidenceEntry,
} from "./RecommendationEvidenceCard";
import { RecommendationAmendDialog } from "./RecommendationAmendDialog";

export interface RecommendationInboxItem {
  id: string;
  learnerId: string;
  type: string;
  title: string;
  parentSummary: string;
  currentValue: unknown;
  proposedValue: unknown;
  confidence: number;
  evidence: RecommendationEvidenceEntry[];
  safety: {
    requiresParentApproval: boolean;
    affectsIEP: boolean;
    affectsInstructionalAccess: boolean;
    reversible: boolean;
  };
  status: "PENDING" | "APPROVED" | "AMENDED" | "DECLINED" | "APPLIED" | "FAILED";
}

export interface RecommendationInboxProps {
  recommendations: RecommendationInboxItem[];
  onDecisionMade?: (item: RecommendationInboxItem, action: "accept" | "amend" | "decline") => void;
  /**
   * Optional fetch override (tests pass a stub). Defaults to the global
   * fetch and posts to the recommendation-svc relay endpoint.
   */
  fetchImpl?: typeof fetch;
}

export function RecommendationInbox({
  recommendations,
  onDecisionMade,
  fetchImpl = fetch,
}: RecommendationInboxProps) {
  const [busyId, setBusyId] = useState<string | null>(null);
  const [amendTarget, setAmendTarget] = useState<RecommendationInboxItem | null>(null);

  async function postDecision(
    item: RecommendationInboxItem,
    path: "accept" | "amend" | "decline",
    body: Record<string, unknown>,
  ) {
    setBusyId(item.id);
    try {
      const res = await fetchImpl(`/api/recommendations/${item.id}/${path}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      if (res.ok) {
        onDecisionMade?.(item, path);
      }
    } finally {
      setBusyId(null);
    }
  }

  if (recommendations.length === 0) {
    return (
      <div className="rounded border border-dashed p-4 text-sm text-gray-600">
        No pending recommendations.
      </div>
    );
  }

  return (
    <div className="recommendation-inbox space-y-4">
      {recommendations.map((item) => (
        <article key={item.id} className="rounded border p-4">
          <header className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold">{item.title}</h3>
              <p className="text-xs text-gray-600">{item.type}</p>
            </div>
            <span className="rounded bg-gray-100 px-2 py-0.5 text-xs">
              Confidence {(item.confidence * 100).toFixed(0)}%
            </span>
          </header>
          <p className="mt-2 text-sm">{item.parentSummary}</p>
          <dl className="mt-3 grid grid-cols-2 gap-2 text-sm">
            <div>
              <dt className="text-xs text-gray-600">Current value</dt>
              <dd>{String(item.currentValue ?? "—")}</dd>
            </div>
            <div>
              <dt className="text-xs text-gray-600">Proposed value</dt>
              <dd className="font-medium">{String(item.proposedValue ?? "—")}</dd>
            </div>
          </dl>
          <details className="mt-3">
            <summary className="cursor-pointer text-sm text-blue-700">View evidence</summary>
            <div className="mt-2">
              <RecommendationEvidenceCard evidence={item.evidence} />
            </div>
          </details>
          {item.safety.affectsIEP || item.safety.affectsInstructionalAccess ? (
            <p className="mt-2 rounded bg-amber-50 p-2 text-xs">
              This change affects {item.safety.affectsIEP ? "IEP " : ""}
              {item.safety.affectsInstructionalAccess ? "instructional access" : ""}.{" "}
              {item.safety.reversible ? "Reversible." : "Not reversible."}
            </p>
          ) : null}
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              disabled={busyId === item.id}
              onClick={() =>
                postDecision(item, "accept", {
                  actorRole: "parent",
                })
              }
              className="rounded bg-green-600 px-3 py-1.5 text-sm text-white disabled:opacity-50"
            >
              Accept
            </button>
            <button
              type="button"
              disabled={busyId === item.id}
              onClick={() => setAmendTarget(item)}
              className="rounded border border-blue-600 px-3 py-1.5 text-sm text-blue-700 disabled:opacity-50"
            >
              Amend
            </button>
            <button
              type="button"
              disabled={busyId === item.id}
              onClick={() =>
                postDecision(item, "decline", {
                  actorRole: "parent",
                })
              }
              className="rounded border border-red-600 px-3 py-1.5 text-sm text-red-700 disabled:opacity-50"
            >
              Decline
            </button>
          </div>
        </article>
      ))}
      <RecommendationAmendDialog
        open={amendTarget !== null}
        recommendationTitle={amendTarget?.title ?? ""}
        initialValue={String(amendTarget?.proposedValue ?? "")}
        onCancel={() => setAmendTarget(null)}
        onConfirm={(amendedValue) => {
          if (!amendTarget) return;
          void postDecision(amendTarget, "amend", {
            actorRole: "parent",
            amendedValue,
          });
          setAmendTarget(null);
        }}
      />
    </div>
  );
}

export default RecommendationInbox;
