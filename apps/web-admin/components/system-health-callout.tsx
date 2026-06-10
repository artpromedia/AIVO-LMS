import type { PlatformSystemHealthIssue } from "@aivo/admin-api";

/**
 * Amber callout listing the system-health sources admin-svc could not read
 * (missing table, revoked grant, …). Rendered alongside the metric cards so a
 * partially-degraded dashboard names exactly what is broken instead of 500ing.
 */
export function SystemHealthDegradedCallout({
  issues,
  className,
}: {
  issues: PlatformSystemHealthIssue[];
  className?: string;
}) {
  if (issues.length === 0) return null;
  return (
    <div className={`admin-warning ${className ?? ""}`}>
      <p>
        Some system-health signals are unavailable; their metrics show 0 until admin-svc can read
        them again.
      </p>
      <ul className="mt-1 list-inside list-disc text-sm font-medium">
        {issues.map((issue) => (
          <li key={issue.source}>
            <span className="font-mono">{issue.source}</span>: {issue.error}
          </li>
        ))}
      </ul>
    </div>
  );
}
