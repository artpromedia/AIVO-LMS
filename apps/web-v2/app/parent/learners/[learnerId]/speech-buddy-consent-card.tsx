"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";

const AGE_BANDS = [
  { value: "6-9", label: "Ages 6–9" },
  { value: "10-12", label: "Ages 10–12" },
  { value: "13-15", label: "Ages 13–15" },
] as const;

/**
 * Parent control to grant / revoke Speech Buddy consent for one learner.
 * Talks to `/api/bff/parent/learners/:id/speech-buddy-consent`, which is
 * dual-path (real family-svc when enabled, in-memory store in dev/mock).
 */
export function SpeechBuddyConsentCard({
  learnerId,
  learnerName,
}: {
  learnerId: string;
  learnerName: string;
}) {
  const base = `/api/bff/parent/learners/${learnerId}/speech-buddy-consent`;
  const [loading, setLoading] = React.useState(true);
  const [granted, setGranted] = React.useState(false);
  const [grantedBand, setGrantedBand] = React.useState<string | null>(null);
  const [ageBand, setAgeBand] = React.useState<string>("6-9");
  const [error, setError] = React.useState<string | null>(null);
  const [pending, startTransition] = React.useTransition();

  React.useEffect(() => {
    let alive = true;
    fetch(base)
      .then((r) => r.json())
      .then((j) => {
        if (!alive) return;
        const data = j?.data;
        if (data) {
          setGranted(Boolean(data.granted));
          if (data.consent?.ageBand) {
            setGrantedBand(data.consent.ageBand);
            setAgeBand(data.consent.ageBand);
          }
        }
      })
      .catch(() => {
        if (alive) setError("Couldn't load consent status.");
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [base]);

  function grant() {
    setError(null);
    startTransition(async () => {
      const res = await fetch(base, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ ageBand }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(j?.error?.message ?? "Couldn't save consent.");
        return;
      }
      setGranted(true);
      setGrantedBand(ageBand);
    });
  }

  function revoke() {
    setError(null);
    startTransition(async () => {
      const res = await fetch(base, { method: "DELETE" });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(j?.error?.message ?? "Couldn't revoke consent.");
        return;
      }
      setGranted(false);
      setGrantedBand(null);
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-iw-text-muted">
        Speech Buddy is an optional voice companion that helps {learnerName} practise
        social-emotional skills through short spoken role-plays. It is off until you
        turn it on, every session is safety-filtered, and you can withdraw consent at
        any time.
      </p>

      {loading ? (
        <p className="text-sm text-iw-text-muted">Loading…</p>
      ) : granted ? (
        <div className="flex flex-col gap-3">
          <div
            role="status"
            className="rounded-iw-control border border-aivo-success/40 bg-aivo-success/10 px-3.5 py-2.5 text-sm text-iw-text-strong"
          >
            Speech Buddy is <strong>enabled</strong>
            {grantedBand ? ` for ${grantedBand.replace("-", "–")}` : ""}.
          </div>
          <div>
            <Button variant="outline" size="sm" disabled={pending} onClick={revoke}>
              {pending ? "Working…" : "Withdraw consent"}
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="sb-age-band" className="text-sm font-medium text-iw-text-strong">
              Age band
            </label>
            <select
              id="sb-age-band"
              value={ageBand}
              onChange={(e) => setAgeBand(e.target.value)}
              className="h-12 px-3 rounded-iw-control bg-white border border-iw-border text-base text-iw-text-strong focus:border-[var(--aivo-sensory-primary)] focus:ring-2 focus:ring-[var(--aivo-sensory-primary)]/20 outline-none"
            >
              {AGE_BANDS.map((b) => (
                <option key={b.value} value={b.value}>
                  {b.label}
                </option>
              ))}
            </select>
            <p className="text-xs text-iw-text-muted">
              We tune the language and pacing of Speech Buddy to this band.
            </p>
          </div>
          <div>
            <Button size="sm" disabled={pending} onClick={grant}>
              {pending ? "Working…" : "Enable Speech Buddy"}
            </Button>
          </div>
        </div>
      )}

      {error ? (
        <p role="alert" className="text-sm text-aivo-danger">
          {error}
        </p>
      ) : null}
    </div>
  );
}
