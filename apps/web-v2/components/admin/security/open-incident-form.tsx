"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";

export function OpenIncidentForm() {
  const [title, setTitle] = useState("");
  const [summary, setSummary] = useState("");
  const [severity, setSeverity] = useState<"sev1" | "sev2" | "sev3" | "sev4">("sev3");
  const [customerImpact, setCustomerImpact] = useState(false);
  const [regulator, setRegulator] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch("/api/bff/admin/security/incidents", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          title,
          summary,
          severity,
          customerImpact,
          regulatorNotificationRequired: regulator,
        }),
      });
      const data = await res.json();
      if (!data.ok) {
        setMsg(data.error?.message ?? "Failed to open incident.");
      } else {
        setTitle("");
        setSummary("");
        window.location.reload();
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-xs font-semibold text-aivo-ink-soft">Title</span>
          <input
            className="rounded-md border border-iw-border bg-iw-card px-3 py-2 text-sm"
            value={title}
            required
            maxLength={160}
            onChange={(e) => setTitle(e.target.value)}
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-xs font-semibold text-aivo-ink-soft">Severity</span>
          <select
            className="rounded-md border border-iw-border bg-iw-card px-3 py-2 text-sm"
            value={severity}
            onChange={(e) => setSeverity(e.target.value as typeof severity)}
          >
            <option value="sev1">SEV1 — critical</option>
            <option value="sev2">SEV2 — major</option>
            <option value="sev3">SEV3 — degraded</option>
            <option value="sev4">SEV4 — minor</option>
          </select>
        </label>
      </div>
      <label className="flex flex-col gap-1 text-sm">
        <span className="text-xs font-semibold text-aivo-ink-soft">Summary</span>
        <textarea
          className="rounded-md border border-iw-border bg-iw-card px-3 py-2 text-sm"
          rows={3}
          value={summary}
          required
          maxLength={2000}
          onChange={(e) => setSummary(e.target.value)}
        />
      </label>
      <div className="flex flex-wrap gap-4 text-sm">
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={customerImpact}
            onChange={(e) => setCustomerImpact(e.target.checked)}
          />
          Customer impact
        </label>
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={regulator}
            onChange={(e) => setRegulator(e.target.checked)}
          />
          Regulator notification required
        </label>
      </div>
      {msg && <p className="text-sm text-aivo-danger">{msg}</p>}
      <Button type="submit" disabled={busy}>
        {busy ? "Opening…" : "Open incident"}
      </Button>
    </form>
  );
}
