"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";

const GRANTABLE = ["parent", "teacher", "caregiver", "therapist", "learner"] as const;
const LABEL: Record<string, string> = {
  parent: "Parent",
  teacher: "Teacher",
  caregiver: "Caregiver",
  therapist: "Therapist",
  learner: "Learner",
};

/**
 * Platform-admin control to grant / revoke a user's *additional* roles
 * (ADR 0020 multi-role). Drives `/api/bff/admin/users/:id/roles`, which is
 * dual-path (identity-svc when enabled, in-memory store in dev/mock). Takes
 * effect on the user's next sign-in (availableRoles is minted into the JWT).
 */
export function UserRolesCard({ userId }: { userId: string }) {
  const base = `/api/bff/admin/users/${userId}/roles`;
  const [additional, setAdditional] = React.useState<string[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [pick, setPick] = React.useState("");
  const [pending, startTransition] = React.useTransition();
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    let alive = true;
    fetch(base)
      .then((r) => r.json())
      .then((j) => {
        if (alive && j?.data?.additionalRoles) setAdditional(j.data.additionalRoles as string[]);
      })
      .catch(() => {
        if (alive) setError("Couldn't load roles.");
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [base]);

  const options = GRANTABLE.filter((r) => !additional.includes(r));

  function grant() {
    if (!pick) return;
    setError(null);
    startTransition(async () => {
      const res = await fetch(base, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ role: pick }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(j?.error?.message ?? "Couldn't grant the role.");
        return;
      }
      setAdditional((prev) => (prev.includes(pick) ? prev : [...prev, pick]));
      setPick("");
    });
  }

  function revoke(role: string) {
    setError(null);
    startTransition(async () => {
      const res = await fetch(`${base}?role=${encodeURIComponent(role)}`, { method: "DELETE" });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(j?.error?.message ?? "Couldn't revoke the role.");
        return;
      }
      setAdditional((prev) => prev.filter((r) => r !== role));
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-aivo-ink-soft">
        Additional roles let this user act as more than their primary role and switch between them
        in the app without signing out. Changes take effect on their next sign-in.
      </p>

      {loading ? (
        <p className="text-sm text-aivo-ink-soft">Loading…</p>
      ) : (
        <>
          <div className="flex flex-wrap gap-2">
            {additional.length === 0 ? (
              <span className="text-sm text-aivo-ink-soft">No additional roles.</span>
            ) : (
              additional.map((role) => (
                <span
                  key={role}
                  className="inline-flex items-center gap-1.5 rounded-full border border-aivo-border bg-aivo-surface-2 px-2.5 py-1 text-xs font-medium"
                >
                  {LABEL[role] ?? role}
                  <button
                    type="button"
                    aria-label={`Remove ${LABEL[role] ?? role}`}
                    disabled={pending}
                    onClick={() => revoke(role)}
                    className="text-aivo-muted hover:text-aivo-danger"
                  >
                    ×
                  </button>
                </span>
              ))
            )}
          </div>

          <div className="flex items-center gap-2">
            <select
              value={pick}
              onChange={(e) => setPick(e.target.value)}
              aria-label="Role to grant"
              className="h-10 rounded-iw-control border border-aivo-border bg-white px-3 text-sm outline-none focus:border-aivo-primary"
            >
              <option value="">Add a role…</option>
              {options.map((r) => (
                <option key={r} value={r}>
                  {LABEL[r]}
                </option>
              ))}
            </select>
            <Button size="sm" disabled={pending || !pick} onClick={grant}>
              {pending ? "Working…" : "Grant"}
            </Button>
          </div>
        </>
      )}

      {error ? (
        <p role="alert" className="text-sm text-aivo-danger">
          {error}
        </p>
      ) : null}
    </div>
  );
}
