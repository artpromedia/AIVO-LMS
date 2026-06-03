"use client";

import * as React from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { RaiModel, RaiOptOut } from "@/lib/services/responsible-ai-svc";

interface OptOutMatrixProps {
  models: RaiModel[];
  optOuts: RaiOptOut[];
  tenantId: string;
}

/**
 * Per-model opt-out toggles for a district. Toggling on POSTs an opt-out,
 * toggling off DELETEs it. Optimistic state with rollback on failure.
 */
export function OptOutMatrix({ models, optOuts, tenantId }: OptOutMatrixProps) {
  const initial = React.useMemo(() => {
    const map: Record<string, { optedOut: boolean; id?: string }> = {};
    for (const m of models) {
      const existing = optOuts.find((o) => o?.modelId === m.id);
      map[m.id] = { optedOut: Boolean(existing), id: existing?.id };
    }
    return map;
  }, [models, optOuts]);

  const [state, setState] = React.useState(initial);
  const [busy, setBusy] = React.useState<Record<string, boolean>>({});
  const [error, setError] = React.useState<string>("");

  async function toggle(modelId: string) {
    const current = state[modelId];
    const next = !current.optedOut;
    setBusy((b) => ({ ...b, [modelId]: true }));
    setError("");
    // Optimistic.
    setState((s) => ({ ...s, [modelId]: { ...s[modelId], optedOut: next } }));

    try {
      if (next) {
        const res = await fetch("/api/bff/admin/ai/optouts", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ tenantId, modelId, reason: "District opt-out" }),
        });
        const json = await res.json().catch(() => ({}));
        if (!res.ok || json?.ok === false) throw new Error(json?.error?.message ?? "Failed");
        const newId = json?.data?.optOut?.id ?? json?.data?.id;
        setState((s) => ({ ...s, [modelId]: { optedOut: true, id: newId } }));
      } else {
        const id = current.id;
        const res = await fetch(
          `/api/bff/admin/ai/optouts?tenantId=${encodeURIComponent(tenantId)}${
            id ? `&id=${encodeURIComponent(id)}` : ""
          }&modelId=${encodeURIComponent(modelId)}`,
          { method: "DELETE" },
        );
        const json = await res.json().catch(() => ({}));
        if (!res.ok || json?.ok === false) throw new Error(json?.error?.message ?? "Failed");
        setState((s) => ({ ...s, [modelId]: { optedOut: false, id: undefined } }));
      }
    } catch (err) {
      // Roll back.
      setState((s) => ({ ...s, [modelId]: current }));
      setError(err instanceof Error ? err.message : "Failed to update opt-out.");
    } finally {
      setBusy((b) => ({ ...b, [modelId]: false }));
    }
  }

  return (
    <Card className="overflow-hidden p-0">
      {error ? <p className="px-4 py-2 text-sm text-aivo-danger">{error}</p> : null}
      <table className="w-full text-sm">
        <thead className="bg-aivo-surface-2 text-xs uppercase tracking-wide text-aivo-ink-soft">
          <tr>
            <th className="px-4 py-3 text-left">Model</th>
            <th className="px-4 py-3 text-left">Provider</th>
            <th className="px-4 py-3 text-left">Status</th>
            <th className="px-4 py-3 text-left">Opt out</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-aivo-border">
          {models.map((m) => {
            const s = state[m.id];
            return (
              <tr key={m.id} className="hover:bg-aivo-surface-2/40">
                <td className="px-4 py-3 font-medium">{m.name}</td>
                <td className="px-4 py-3 text-aivo-ink-soft">{m.provider}</td>
                <td className="px-4 py-3">
                  {s.optedOut ? (
                    <Badge tone="danger">Opted out</Badge>
                  ) : (
                    <Badge tone="success">Enabled</Badge>
                  )}
                </td>
                <td className="px-4 py-3">
                  <button
                    type="button"
                    role="switch"
                    aria-checked={s.optedOut}
                    disabled={busy[m.id]}
                    onClick={() => toggle(m.id)}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors disabled:opacity-50 ${
                      s.optedOut ? "bg-aivo-danger" : "bg-aivo-border"
                    }`}
                  >
                    <span
                      className={`inline-block h-5 w-5 transform rounded-full bg-white transition-transform ${
                        s.optedOut ? "translate-x-5" : "translate-x-1"
                      }`}
                    />
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </Card>
  );
}
