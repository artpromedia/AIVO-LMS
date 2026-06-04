"use client";

import * as React from "react";
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogTitle,
  DialogDescription,
  DialogClose,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

/**
 * Start a Secure Impersonation ("View As") session.
 *
 * There's no user-search API wired into web-v2 yet, so the picker filters an
 * internal sample list of users. On submit we POST to the START BFF which
 * proxies to identity-svc and (on success) sets the `aivo_impersonation`
 * cookie; we then reload so AppShell renders the persistent banner.
 */
type SampleUser = { id: string; name: string; role: string };

const SAMPLE_USERS: SampleUser[] = [
  { id: "usr-teacher-1", name: "Dana Whitfield", role: "teacher" },
  { id: "usr-parent-1", name: "Marcus Liang", role: "parent" },
  { id: "usr-learner-1", name: "Priya Anand", role: "learner" },
  { id: "usr-school-admin-1", name: "Rosa Beltran", role: "school_admin" },
  { id: "usr-district-admin-1", name: "Theo Nakamura", role: "district_admin" },
  { id: "usr-therapist-1", name: "Aisha Okoro", role: "therapist" },
];

export function StartImpersonationModal({ trigger }: { trigger?: React.ReactNode }) {
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState("");
  const [selected, setSelected] = React.useState<SampleUser | null>(null);
  const [reason, setReason] = React.useState("");
  const [ttl, setTtl] = React.useState(900);
  const [allowWrites, setAllowWrites] = React.useState(false);
  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const filtered = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return SAMPLE_USERS;
    return SAMPLE_USERS.filter(
      (u) => u.name.toLowerCase().includes(q) || u.role.toLowerCase().includes(q),
    );
  }, [query]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!selected) {
      setError("Select a user to view as.");
      return;
    }
    if (!reason.trim()) {
      setError("A reason is required.");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch("/api/bff/admin/impersonation/start", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          // Placeholder step-up token. Real MFA step-up is triggered
          // server-side by identity-svc; the BFF forwards this header.
          "x-step-up-token": "stepup-placeholder",
        },
        body: JSON.stringify({
          subject_user_id: selected.id,
          reason: reason.trim(),
          ttl_seconds: ttl,
          allow_writes: allowWrites,
          subject_consent: true,
        }),
      });
      const json = (await res.json().catch(() => null)) as {
        ok: boolean;
        error?: { userMessage?: string; message?: string };
      } | null;
      if (!res.ok || !json?.ok) {
        setError(
          json?.error?.userMessage ||
            json?.error?.message ||
            `Unable to start View-As (HTTP ${res.status}).`,
        );
        setSubmitting(false);
        return;
      }
      // Success — reload so AppShell reads the new cookie and shows the banner.
      window.location.reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Network error starting View-As.");
      setSubmitting(false);
    }
  }

  const minutes = Math.round(ttl / 60);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger ?? <Button type="button">Start View-As</Button>}
      </DialogTrigger>
      <DialogContent className="max-w-xl">
        <DialogTitle className="text-lg font-semibold text-iw-ink">
          Start a View-As session
        </DialogTitle>
        <DialogDescription className="mt-1 text-sm text-iw-ink-muted">
          Impersonation is fully audited. You will be asked to verify MFA before the session starts.
        </DialogDescription>

        <form onSubmit={onSubmit} className="mt-4 flex flex-col gap-4">
          {/* User picker */}
          <div className="flex flex-col gap-1">
            <label className="text-sm font-semibold text-iw-ink" htmlFor="viewas-user">
              User
            </label>
            <input
              id="viewas-user"
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by name or role…"
              className="h-10 rounded-iw-card border border-iw-border bg-iw-raised px-3 text-sm text-iw-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-iw-ring"
            />
            <div className="mt-1 max-h-40 overflow-auto rounded-iw-card border border-iw-border">
              {filtered.length === 0 ? (
                <p className="px-3 py-2 text-xs text-iw-ink-muted">No matching users.</p>
              ) : (
                filtered.map((u) => {
                  const isSel = selected?.id === u.id;
                  return (
                    <button
                      key={u.id}
                      type="button"
                      onClick={() => setSelected(u)}
                      className={
                        "flex w-full items-center justify-between px-3 py-2 text-left text-sm " +
                        (isSel ? "bg-iw-accent-soft text-iw-primary" : "hover:bg-iw-card")
                      }
                      aria-pressed={isSel}
                    >
                      <span className="font-medium">{u.name}</span>
                      <span className="text-xs text-iw-ink-muted">{u.role}</span>
                    </button>
                  );
                })
              )}
            </div>
            {selected ? (
              <p className="text-xs text-iw-ink-muted">
                Selected: <span className="font-semibold text-iw-ink">{selected.name}</span> (
                {selected.role})
              </p>
            ) : null}
          </div>

          {/* Reason */}
          <div className="flex flex-col gap-1">
            <label className="text-sm font-semibold text-iw-ink" htmlFor="viewas-reason">
              Reason <span className="text-aivo-danger">*</span>
            </label>
            <textarea
              id="viewas-reason"
              required
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={3}
              placeholder="Why are you viewing as this user? (support ticket, audit, etc.)"
              className="rounded-iw-card border border-iw-border bg-iw-raised px-3 py-2 text-sm text-iw-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-iw-ring"
            />
          </div>

          {/* TTL slider */}
          <div className="flex flex-col gap-1">
            <label className="text-sm font-semibold text-iw-ink" htmlFor="viewas-ttl">
              Session length: {minutes} min
            </label>
            <input
              id="viewas-ttl"
              type="range"
              min={300}
              max={1800}
              step={300}
              value={ttl}
              onChange={(e) => setTtl(Number(e.target.value))}
              className="w-full accent-iw-primary"
            />
            <div className="flex justify-between text-[11px] text-iw-ink-muted">
              <span>5 min</span>
              <span>30 min</span>
            </div>
          </div>

          {/* Write toggle */}
          <label className="flex items-start gap-2 rounded-iw-card border border-iw-border bg-iw-warm-soft p-3">
            <input
              type="checkbox"
              checked={allowWrites}
              onChange={(e) => setAllowWrites(e.target.checked)}
              className="mt-0.5 accent-amber-600"
            />
            <span className="text-sm text-iw-ink">
              <span className="font-semibold">Allow writes (rarely needed)</span>
              <span className="block text-xs text-iw-ink-muted">
                Leave off for read-only investigation. Writes are recorded against you.
              </span>
            </span>
          </label>

          {/* MFA note */}
          <p className="rounded-iw-card bg-iw-accent-soft px-3 py-2 text-xs text-iw-primary">
            You'll be asked to verify MFA before the session begins.
          </p>

          {error ? (
            <p className="rounded-iw-card bg-aivo-danger/15 px-3 py-2 text-sm text-iw-ink">
              {error}
            </p>
          ) : null}

          <div className="flex justify-end gap-2">
            <DialogClose asChild>
              <Button type="button" variant="outline" disabled={submitting}>
                Cancel
              </Button>
            </DialogClose>
            <Button type="submit" disabled={submitting}>
              {submitting ? "Starting…" : "Start View-As"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
