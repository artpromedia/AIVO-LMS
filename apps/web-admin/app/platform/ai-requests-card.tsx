"use client";

import { useState } from "react";
import { AreaTrend, ChartCard, type AreaTrendPoint } from "@aivo/admin-ui";

type Range = "24" | "12" | "6";

const RANGE_LABEL: Record<Range, string> = {
  "24": "Last 24h",
  "12": "Last 12h",
  "6": "Last 6h",
};

/**
 * AI request volume + average latency, with a range selector that narrows the
 * already-fetched 24h window to the last 12h / 6h. Every option only ever shows
 * data the page already loaded (no extra fetch, no synthetic numbers); the two
 * series sit on independent Y axes because request counts and latency (ms) live
 * on very different scales.
 */
export function AiRequestsCard({
  series,
  testId,
}: {
  series: Record<Range, AreaTrendPoint[]>;
  testId: string;
}) {
  const [range, setRange] = useState<Range>("24");
  const data = series[range];
  return (
    <ChartCard
      testId={testId}
      title="AI requests (24h)"
      subtitle="Hourly request volume and average latency from the usage log."
      srRows={data.map((point) => ({
        hour: point.t,
        requests: point.value,
        "avg latency (ms)": point.value2 ?? 0,
      }))}
      legend={
        <div>
          <label className="sr-only" htmlFor="ai-requests-range">
            Time range
          </label>
          <select
            id="ai-requests-range"
            className="admin-filter"
            value={range}
            onChange={(event) => setRange(event.target.value as Range)}
            data-testid="ai-requests-range"
          >
            {(Object.keys(RANGE_LABEL) as Range[]).map((value) => (
              <option key={value} value={value}>
                {RANGE_LABEL[value]}
              </option>
            ))}
          </select>
        </div>
      }
    >
      <AreaTrend
        data={data}
        dualAxis
        title="AI requests"
        description={`Hourly AI request volume and average latency over the ${RANGE_LABEL[range].toLowerCase()}`}
        label="Requests"
        label2="Avg latency (ms)"
      />
    </ChartCard>
  );
}
