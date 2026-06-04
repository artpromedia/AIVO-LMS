"use client";

import { useState } from "react";
import Link from "next/link";

type ComponentOption = { id: string; name: string };

const IMPACTS = ["none", "minor", "major", "critical"] as const;

export function NewIncidentForm({ components }: { components: ComponentOption[] }) {
  const [title, setTitle] = useState("");
  const [impact, setImpact] = useState<string>("minor");
  const [affected, setAffected] = useState<string[]>([]);
  const [message, setMessage] = useState("");
  const [state, setState] = useState<"idle" | "loading" | "done" | "error">("idle");
  const [createdId, setCreatedId] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string>("");

  function toggle(id: string) {
    setAffected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    setState("loading");
    setErrorMsg("");
    try {
      const res = await fetch("/api/bff/admin/status/incidents", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          impact,
          affectedComponentIds: affected,
          message: message.trim(),
        }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        data?: { incident?: { id?: string } };
        error?: { userMessage?: string };
      };
      if (res.ok && data.ok) {
        setCreatedId(data.data?.incident?.id ?? null);
        setState("done");
      } else {
        setErrorMsg(data.error?.userMessage ?? "Failed to create incident.");
        setState("error");
      }
    } catch {
      setErrorMsg("Failed to create incident.");
      setState("error");
    }
  }

  if (state === "done") {
    return (
      <div>
        <p className="text-sm font-medium text-iw-ink">Incident created.</p>
        <div className="mt-4 flex gap-3">
          {createdId ? (
            <Link
              href={`/admin/platform/status/incidents/${createdId}`}
              className="rounded-iw-card bg-iw-primary px-4 py-2 text-sm font-semibold text-white"
            >
              View incident
            </Link>
          ) : null}
          <Link
            href="/admin/platform/status"
            className="rounded-iw-card border border-iw-border px-4 py-2 text-sm font-semibold text-iw-ink"
          >
            Back to status
          </Link>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-5">
      <div>
        <label className="block text-sm font-medium text-iw-ink" htmlFor="inc-title">
          Title
        </label>
        <input
          id="inc-title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          required
          placeholder="Short summary of the incident"
          className="mt-1 w-full rounded-iw-card border border-iw-border bg-iw-card px-3 py-2 text-sm text-iw-ink outline-none focus:border-iw-primary"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-iw-ink" htmlFor="inc-impact">
          Impact
        </label>
        <select
          id="inc-impact"
          value={impact}
          onChange={(e) => setImpact(e.target.value)}
          className="mt-1 w-full rounded-iw-card border border-iw-border bg-iw-card px-3 py-2 text-sm text-iw-ink outline-none focus:border-iw-primary"
        >
          {IMPACTS.map((i) => (
            <option key={i} value={i}>
              {i}
            </option>
          ))}
        </select>
      </div>

      <div>
        <p className="block text-sm font-medium text-iw-ink">Affected components</p>
        {components.length === 0 ? (
          <p className="mt-1 text-xs text-iw-ink-muted">No components available.</p>
        ) : (
          <div className="mt-2 grid gap-2 sm:grid-cols-2">
            {components.map((c) => (
              <label key={c.id} className="flex items-center gap-2 text-sm text-iw-ink">
                <input
                  type="checkbox"
                  checked={affected.includes(c.id)}
                  onChange={() => toggle(c.id)}
                />
                {c.name}
              </label>
            ))}
          </div>
        )}
      </div>

      <div>
        <label className="block text-sm font-medium text-iw-ink" htmlFor="inc-message">
          Initial update
        </label>
        <textarea
          id="inc-message"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          rows={4}
          placeholder="What's happening and what are we doing about it?"
          className="mt-1 w-full rounded-iw-card border border-iw-border bg-iw-card px-3 py-2 text-sm text-iw-ink outline-none focus:border-iw-primary"
        />
      </div>

      {state === "error" ? <p className="text-sm text-aivo-danger">{errorMsg}</p> : null}

      <button
        type="submit"
        disabled={state === "loading"}
        className="rounded-iw-card bg-iw-primary px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
      >
        {state === "loading" ? "Creating…" : "Create incident"}
      </button>
    </form>
  );
}
