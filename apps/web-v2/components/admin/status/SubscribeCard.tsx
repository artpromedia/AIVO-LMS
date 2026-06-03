"use client";

import { useState } from "react";
import { Card } from "@/components/ui/card";

export function SubscribeCard() {
  const [email, setEmail] = useState("");
  const [state, setState] = useState<"idle" | "loading" | "done" | "error">("idle");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim()) return;
    setState("loading");
    try {
      const res = await fetch("/api/public/status/subscribe", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ target: email.trim() }),
      });
      const data = (await res.json().catch(() => ({}))) as { ok?: boolean };
      setState(res.ok && data.ok ? "done" : "error");
    } catch {
      setState("error");
    }
  }

  return (
    <Card className="p-[var(--aivo-density-card-pad)]">
      <p className="font-iw-display text-base font-semibold text-iw-ink">Get status updates</p>
      <p className="mt-1 text-sm text-iw-ink-muted">
        Subscribe to receive email notifications when incidents are reported or resolved.
      </p>

      {state === "done" ? (
        <p className="mt-4 text-sm font-medium text-iw-ink">Subscribed! Check your inbox.</p>
      ) : (
        <form onSubmit={submit} className="mt-4 flex flex-col gap-2 sm:flex-row">
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            className="flex-1 rounded-iw-card border border-iw-border bg-iw-card px-3 py-2 text-sm text-iw-ink outline-none focus:border-iw-primary"
          />
          <button
            type="submit"
            disabled={state === "loading"}
            className="rounded-iw-card bg-iw-primary px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
          >
            {state === "loading" ? "Subscribing…" : "Subscribe"}
          </button>
        </form>
      )}

      {state === "error" ? (
        <p className="mt-2 text-sm text-iw-ink-muted">
          We couldn&apos;t complete your subscription right now. Please try again later.
        </p>
      ) : null}

      <div className="mt-4 border-t border-iw-border pt-3 text-xs text-iw-ink-muted">
        <p>Also available: RSS feed at /api/public/status/rss · Webhook integrations on request.</p>
      </div>
    </Card>
  );
}
