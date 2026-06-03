"use client";

import * as React from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import type { RaiPolicy } from "@/lib/services/responsible-ai-svc";

interface PolicyEditorProps {
  policy: RaiPolicy;
}

function joinCsv(value: unknown): string {
  return Array.isArray(value) ? value.join(", ") : "";
}

function splitCsv(value: string): string[] {
  return value
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

/**
 * Edit a Responsible-AI safety policy. PUTs the full field set to the BFF.
 */
export function PolicyEditor({ policy }: PolicyEditorProps) {
  const [blockedCategories, setBlockedCategories] = React.useState(
    joinCsv(policy?.blockedCategories),
  );
  const [maxSeverity, setMaxSeverity] = React.useState<string>(policy?.maxSeverity ?? "medium");
  const [minAge, setMinAge] = React.useState<string>(
    policy?.ageGating?.minAge != null ? String(policy.ageGating.minAge) : "",
  );
  const [requireGuardianConsent, setRequireGuardianConsent] = React.useState<boolean>(
    Boolean(policy?.ageGating?.requireGuardianConsent),
  );
  const [allowedRegions, setAllowedRegions] = React.useState(joinCsv(policy?.allowedRegions));
  const [blockedRegions, setBlockedRegions] = React.useState(joinCsv(policy?.blockedRegions));
  const [enabled, setEnabled] = React.useState<boolean>(Boolean(policy?.enabled));

  const [status, setStatus] = React.useState<"idle" | "saving" | "saved" | "error">("idle");
  const [message, setMessage] = React.useState<string>("");

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus("saving");
    setMessage("");
    try {
      const res = await fetch("/api/bff/admin/ai/policies", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          id: policy.id,
          blockedCategories: splitCsv(blockedCategories),
          maxSeverity,
          ageGating: {
            minAge: minAge ? Number(minAge) : null,
            requireGuardianConsent,
          },
          allowedRegions: splitCsv(allowedRegions),
          blockedRegions: splitCsv(blockedRegions),
          enabled,
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || json?.ok === false) {
        setStatus("error");
        setMessage(json?.error?.message ?? "Failed to save policy.");
        return;
      }
      setStatus("saved");
      setMessage("Policy saved.");
    } catch (err) {
      setStatus("error");
      setMessage(err instanceof Error ? err.message : "Failed to save policy.");
    }
  }

  return (
    <Card className="p-[var(--aivo-density-card-pad)]">
      <form onSubmit={onSubmit} className="space-y-5">
        <div>
          <label className="text-xs uppercase tracking-wide text-aivo-ink-soft" htmlFor="blocked-cats">
            Blocked categories (comma separated)
          </label>
          <input
            id="blocked-cats"
            type="text"
            value={blockedCategories}
            onChange={(e) => setBlockedCategories(e.target.value)}
            className="mt-1 block w-full rounded-iw-control border border-iw-border bg-iw-raised px-3 py-2 text-sm"
          />
        </div>

        <div>
          <label className="text-xs uppercase tracking-wide text-aivo-ink-soft" htmlFor="max-sev">
            Max severity
          </label>
          <select
            id="max-sev"
            value={maxSeverity}
            onChange={(e) => setMaxSeverity(e.target.value)}
            className="mt-1 block w-full rounded-iw-control border border-iw-border bg-iw-raised px-3 py-2 text-sm"
          >
            <option value="low">low</option>
            <option value="medium">medium</option>
            <option value="high">high</option>
          </select>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="text-xs uppercase tracking-wide text-aivo-ink-soft" htmlFor="min-age">
              Minimum age
            </label>
            <input
              id="min-age"
              type="number"
              min={0}
              value={minAge}
              onChange={(e) => setMinAge(e.target.value)}
              className="mt-1 block w-full rounded-iw-control border border-iw-border bg-iw-raised px-3 py-2 text-sm"
            />
          </div>
          <label className="flex items-center gap-2 pt-6 text-sm">
            <input
              type="checkbox"
              checked={requireGuardianConsent}
              onChange={(e) => setRequireGuardianConsent(e.target.checked)}
            />
            Require guardian consent
          </label>
        </div>

        <div>
          <label className="text-xs uppercase tracking-wide text-aivo-ink-soft" htmlFor="allowed-regions">
            Allowed regions (comma separated)
          </label>
          <input
            id="allowed-regions"
            type="text"
            value={allowedRegions}
            onChange={(e) => setAllowedRegions(e.target.value)}
            className="mt-1 block w-full rounded-iw-control border border-iw-border bg-iw-raised px-3 py-2 text-sm"
          />
        </div>

        <div>
          <label className="text-xs uppercase tracking-wide text-aivo-ink-soft" htmlFor="blocked-regions">
            Blocked regions (comma separated)
          </label>
          <input
            id="blocked-regions"
            type="text"
            value={blockedRegions}
            onChange={(e) => setBlockedRegions(e.target.value)}
            className="mt-1 block w-full rounded-iw-control border border-iw-border bg-iw-raised px-3 py-2 text-sm"
          />
        </div>

        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={enabled}
            onChange={(e) => setEnabled(e.target.checked)}
          />
          Policy enabled
        </label>

        <div className="flex items-center gap-3">
          <Button type="submit" disabled={status === "saving"}>
            {status === "saving" ? "Saving…" : "Save policy"}
          </Button>
          {message ? (
            <span
              className={`text-sm ${status === "error" ? "text-aivo-danger" : "text-aivo-ink-soft"}`}
            >
              {message}
            </span>
          ) : null}
        </div>
      </form>
    </Card>
  );
}
