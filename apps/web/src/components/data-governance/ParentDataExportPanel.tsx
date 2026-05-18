"use client";

import { useState } from "react";

export interface ExportArtifact {
  format: "json" | "markdown" | "csv_summary";
  filename: string;
  contents: string;
}

export interface ExportJob {
  id: string;
  learnerId: string;
  formats: Array<ExportArtifact["format"]>;
  artifacts: ExportArtifact[];
  createdAt: string;
}

export interface ParentDataExportPanelProps {
  learnerId: string;
  /** Optional fetch override for tests. */
  fetchImpl?: typeof fetch;
}

export function ParentDataExportPanel({
  learnerId,
  fetchImpl = fetch,
}: ParentDataExportPanelProps) {
  const [busy, setBusy] = useState(false);
  const [job, setJob] = useState<ExportJob | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function requestExport() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetchImpl(`/api/exports/parent`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ learnerId }),
      });
      if (!res.ok) {
        setError(`Export failed (${res.status}).`);
        return;
      }
      const data = (await res.json()) as ExportJob;
      setJob(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Export failed.");
    } finally {
      setBusy(false);
    }
  }

  function downloadArtifact(artifact: ExportArtifact) {
    if (typeof window === "undefined") return;
    const blob = new Blob([artifact.contents], {
      type:
        artifact.format === "json"
          ? "application/json"
          : artifact.format === "csv_summary"
            ? "text/csv"
            : "text/markdown",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = artifact.filename;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <section className="parent-data-export-panel rounded border p-4">
      <h3 className="text-lg font-semibold">Export learner data</h3>
      <p className="text-xs text-gray-600">
        Build a JSON, Markdown, and CSV bundle of profile, recommendations, baseline summaries,
        lesson progress, homework, problem sessions, parent decisions, teacher observations, and
        audit counts. Raw IEP / private notes / OCR text are stripped.
      </p>
      <button
        type="button"
        onClick={requestExport}
        disabled={busy}
        className="mt-2 rounded bg-blue-600 px-3 py-1.5 text-white disabled:opacity-50"
      >
        {busy ? "Building export…" : "Request export"}
      </button>
      {error ? <p className="mt-2 text-sm text-red-600">{error}</p> : null}
      {job ? (
        <div className="mt-3 rounded bg-gray-50 p-3 text-sm">
          <p className="font-medium">Export ready</p>
          <ul className="mt-1 space-y-1">
            {job.artifacts.map((a) => (
              <li key={a.format}>
                <button
                  type="button"
                  onClick={() => downloadArtifact(a)}
                  className="text-blue-700 underline"
                >
                  {a.filename}
                </button>
                <span className="ml-2 text-xs text-gray-600">{a.format}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  );
}

export default ParentDataExportPanel;
