"use client";

export interface RecommendationEvidenceEntry {
  source: string;
  summary: string;
  occurredAt?: string;
  metric?: string;
  value?: number | string | boolean;
}

export interface RecommendationEvidenceCardProps {
  evidence: RecommendationEvidenceEntry[];
}

const SOURCE_LABEL: Record<string, string> = {
  baseline: "Baseline assessment",
  lesson: "Lesson session",
  homework: "Homework session",
  problem_session: "Problem session",
  teacher_observation: "Teacher observation",
  parent_observation: "Parent observation",
  regression_check: "Regression check",
};

/**
 * Renders the evidence trail for a single recommendation. Each entry
 * shows the source, a short summary, and optionally the metric / value
 * pair that triggered the candidate.
 */
export function RecommendationEvidenceCard({ evidence }: RecommendationEvidenceCardProps) {
  if (evidence.length === 0) {
    return (
      <div className="rounded border border-dashed p-3 text-sm text-gray-600">
        No evidence recorded yet.
      </div>
    );
  }
  return (
    <ul className="rounded border bg-gray-50 p-3 text-sm">
      {evidence.map((entry, idx) => (
        <li key={idx} className="mb-2 last:mb-0">
          <span className="font-semibold">{SOURCE_LABEL[entry.source] ?? entry.source}</span>
          <span className="ml-2 text-gray-700">{entry.summary}</span>
          {entry.metric ? (
            <span className="ml-2 rounded bg-white px-1 text-xs text-gray-600">
              {entry.metric}={String(entry.value ?? "")}
            </span>
          ) : null}
          {entry.occurredAt ? (
            <span className="ml-2 text-xs text-gray-500">
              {new Date(entry.occurredAt).toLocaleString()}
            </span>
          ) : null}
        </li>
      ))}
    </ul>
  );
}

export default RecommendationEvidenceCard;
