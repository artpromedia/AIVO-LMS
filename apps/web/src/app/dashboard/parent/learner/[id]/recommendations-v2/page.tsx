"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import {
  RecommendationInbox,
  type RecommendationInboxItem,
} from "../../../../../../components/recommendations/RecommendationInbox";
import {
  RecommendationDecisionHistory,
  type RecommendationDecision,
} from "../../../../../../components/recommendations/RecommendationDecisionHistory";

/**
 * Sprint 07 parent dashboard: enterprise recommendations v2. Lists all
 * pending recommendations from the recommendation-svc for the active
 * learner and shows the decision history below. The legacy recommendations
 * page is untouched at /dashboard/parent/learner/[id]/recommendations.
 */
export default function RecommendationsV2Page() {
  const params = useParams<{ id: string }>();
  const learnerId = params?.id;
  const [pending, setPending] = useState<RecommendationInboxItem[]>([]);
  const [history, setHistory] = useState<RecommendationDecision[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!learnerId) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/recommendations/learner/${learnerId}`);
        if (!res.ok) {
          setError(`Failed to load recommendations (${res.status}).`);
          return;
        }
        const data = (await res.json()) as {
          pending?: RecommendationInboxItem[];
          history?: RecommendationDecision[];
        };
        if (cancelled) return;
        setPending(data.pending ?? []);
        setHistory(data.history ?? []);
      } catch (err) {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : "Failed to load recommendations.");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [learnerId]);

  function handleDecisionMade(item: RecommendationInboxItem, action: string) {
    setPending((items) => items.filter((i) => i.id !== item.id));
    setHistory((prev) => [
      {
        id: item.id,
        type: item.type,
        status:
          action === "accept" ? "APPLIED" : action === "amend" ? "APPLIED" : "DECLINED",
        decidedAt: new Date().toISOString(),
        title: item.title,
      },
      ...prev,
    ]);
  }

  return (
    <main className="recommendations-v2-page mx-auto max-w-3xl space-y-6 p-4">
      <header>
        <h1 className="text-2xl font-bold">Recommendations</h1>
        <p className="text-sm text-gray-600">
          These are evidence-based suggestions. Accept, amend, or decline each one.
        </p>
      </header>
      {error ? <p className="text-sm text-red-600">{error}</p> : null}

      <section>
        <h2 className="mb-2 text-lg font-semibold">Pending</h2>
        <RecommendationInbox
          recommendations={pending}
          onDecisionMade={handleDecisionMade}
        />
      </section>

      <section>
        <h2 className="mb-2 text-lg font-semibold">Decision history</h2>
        <RecommendationDecisionHistory decisions={history} />
      </section>
    </main>
  );
}
