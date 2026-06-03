"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const ORDER = ["investigating", "identified", "monitoring", "resolved"] as const;

function nextLifecycle(current: string): string | null {
  const idx = ORDER.indexOf(current as (typeof ORDER)[number]);
  if (idx === -1) return ORDER[0];
  if (idx >= ORDER.length - 1) return null;
  return ORDER[idx + 1];
}

export function IncidentLifecycleControls({
  incidentId,
  current,
}: {
  incidentId: string;
  current: string;
}) {
  const router = useRouter();
  const [postmortemUrl, setPostmortemUrl] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const next = nextLifecycle(current);

  async function patch(payload: Record<string, unknown>) {
    setBusy(true);
    setError("");
    try {
      const res = await fetch(`/api/bff/admin/status/incidents/${incidentId}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        error?: { userMessage?: string };
      };
      if (res.ok && data.ok) {
        router.refresh();
      } else {
        setError(data.error?.userMessage ?? "Update failed.");
      }
    } catch {
      setError("Update failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-5">
      <div>
        <p className="text-xs uppercase tracking-wide text-iw-ink-muted">Current</p>
        <p className="mt-0.5 text-sm font-semibold capitalize text-iw-ink">
          {current.replace(/_/g, " ")}
        </p>
      </div>

      <div>
        <label className="block text-sm font-medium text-iw-ink" htmlFor="lc-message">
          Update note
        </label>
        <textarea
          id="lc-message"
          rows={3}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="Optional message for this update"
          className="mt-1 w-full rounded-iw-card border border-iw-border bg-iw-card px-3 py-2 text-sm text-iw-ink outline-none focus:border-iw-primary"
        />
      </div>

      {next ? (
        <button
          type="button"
          disabled={busy}
          onClick={() => patch({ lifecycle: next, message: message.trim() || undefined })}
          className="w-full rounded-iw-card bg-iw-primary px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
        >
          {busy ? "Updating…" : `Advance to ${next.replace(/_/g, " ")}`}
        </button>
      ) : (
        <p className="text-sm text-iw-ink-muted">This incident is resolved.</p>
      )}

      <div className="border-t border-iw-border pt-4">
        <label className="block text-sm font-medium text-iw-ink" htmlFor="lc-postmortem">
          Post-mortem URL
        </label>
        <input
          id="lc-postmortem"
          type="url"
          value={postmortemUrl}
          onChange={(e) => setPostmortemUrl(e.target.value)}
          placeholder="https://…"
          className="mt-1 w-full rounded-iw-card border border-iw-border bg-iw-card px-3 py-2 text-sm text-iw-ink outline-none focus:border-iw-primary"
        />
        <button
          type="button"
          disabled={busy || !postmortemUrl.trim()}
          onClick={() => patch({ postmortemUrl: postmortemUrl.trim() })}
          className="mt-2 w-full rounded-iw-card border border-iw-border px-4 py-2 text-sm font-semibold text-iw-ink disabled:opacity-60"
        >
          Save post-mortem link
        </button>
      </div>

      {error ? <p className="text-sm text-aivo-danger">{error}</p> : null}
    </div>
  );
}
