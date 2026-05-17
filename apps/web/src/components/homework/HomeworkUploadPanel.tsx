"use client";

import { useState } from "react";

export interface DetectedProblem {
  id: string;
  prompt: string;
  subject?: string;
  visualElements?: string[];
}

export interface HomeworkUploadResult {
  text: string;
  confidence: number;
  detectedProblems: DetectedProblem[];
}

export interface HomeworkUploadPanelProps {
  sessionId: string;
  onExtracted: (result: HomeworkUploadResult) => void;
  /**
   * Optional fetch override (used by tests). Defaults to the global
   * fetch and posts to /api/homework-sessions/:id/extract on the
   * homework-svc relay route exposed by the Next.js API layer.
   */
  fetchImpl?: typeof fetch;
}

export function HomeworkUploadPanel({
  sessionId,
  onExtracted,
  fetchImpl = fetch,
}: HomeworkUploadPanelProps) {
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!text.trim()) {
      setError("Type or paste the homework problem first.");
      return;
    }
    setError(null);
    setBusy(true);
    try {
      const res = await fetchImpl(`/api/homework-sessions/${sessionId}/extract`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          mimeType: "text/plain",
          learnerId: "current",
          text,
        }),
      });
      if (!res.ok) {
        throw new Error(`Extraction failed (${res.status}).`);
      }
      const data = (await res.json()) as HomeworkUploadResult;
      onExtracted(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Extraction failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="homework-upload-panel">
      <label htmlFor="hw-text" className="block text-sm font-medium">
        Type or paste your homework
      </label>
      <textarea
        id="hw-text"
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={6}
        className="w-full rounded border p-2"
        placeholder="Paste a problem or upload a photo of your homework."
        disabled={busy}
      />
      <div className="mt-2 flex items-center gap-2">
        <button
          type="submit"
          disabled={busy}
          className="rounded bg-blue-600 px-3 py-1.5 text-white disabled:opacity-50"
        >
          {busy ? "Extracting…" : "Extract problems"}
        </button>
        {error ? <span className="text-sm text-red-600">{error}</span> : null}
      </div>
    </form>
  );
}

export default HomeworkUploadPanel;
