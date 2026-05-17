"use client";

export interface RecommendationDecision {
  id: string;
  type: string;
  status: "PENDING" | "APPROVED" | "AMENDED" | "DECLINED" | "APPLIED" | "FAILED";
  decidedAt?: string;
  title: string;
  reason?: string;
}

export interface RecommendationDecisionHistoryProps {
  decisions: RecommendationDecision[];
}

const STATUS_STYLE: Record<RecommendationDecision["status"], string> = {
  PENDING: "bg-gray-200 text-gray-800",
  APPROVED: "bg-green-200 text-green-800",
  AMENDED: "bg-blue-200 text-blue-800",
  DECLINED: "bg-red-200 text-red-800",
  APPLIED: "bg-green-600 text-white",
  FAILED: "bg-yellow-200 text-yellow-900",
};

/**
 * Shows the recommendation decision history for a learner so parents
 * can audit what was approved, amended, or declined and when.
 */
export function RecommendationDecisionHistory({ decisions }: RecommendationDecisionHistoryProps) {
  if (decisions.length === 0) {
    return (
      <p className="rounded border border-dashed p-3 text-sm text-gray-600">
        No decisions yet.
      </p>
    );
  }
  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="border-b text-left">
          <th className="py-1">When</th>
          <th>Title</th>
          <th>Type</th>
          <th>Status</th>
        </tr>
      </thead>
      <tbody>
        {decisions.map((d) => (
          <tr key={d.id} className="border-b last:border-0">
            <td className="py-1 text-xs text-gray-600">
              {d.decidedAt ? new Date(d.decidedAt).toLocaleString() : "—"}
            </td>
            <td>{d.title}</td>
            <td className="text-xs text-gray-700">{d.type}</td>
            <td>
              <span className={`rounded px-2 py-0.5 text-xs ${STATUS_STYLE[d.status]}`}>
                {d.status}
              </span>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export default RecommendationDecisionHistory;
