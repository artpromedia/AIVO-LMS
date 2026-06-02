"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AuditFilterBar, emptyFilter, type AuditFilterValue } from "./AuditFilterBar";
import { AuditTable } from "./AuditTable";
import { AuditDetailDrawer, type AuditProof } from "./AuditDetailDrawer";
import { ExportButton } from "./ExportButton";
import type { AuditEventView } from "@/lib/db/audit-store";

/**
 * Audit console — orchestrates filter bar, table, detail drawer, and export.
 * The active filter persists in localStorage (keyed by `scopeKey`) so it
 * survives navigation, per the sprint's "filter persists" requirement.
 */
export function AuditConsole({ scopeKey }: { scopeKey: string }) {
  const t = useTranslations("admin.audit");
  const storageKey = `aivo.audit.filter.${scopeKey}`;

  const [filter, setFilter] = useState<AuditFilterValue>(emptyFilter());
  const [applied, setApplied] = useState<AuditFilterValue>(emptyFilter());
  const [events, setEvents] = useState<AuditEventView[]>([]);
  const [actions, setActions] = useState<string[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [selected, setSelected] = useState<AuditEventView | null>(null);
  const [proof, setProof] = useState<AuditProof>(null);
  const [loading, setLoading] = useState(false);

  // Restore persisted filter on mount.
  useEffect(() => {
    try {
      const raw = localStorage.getItem(storageKey);
      if (raw) {
        const parsed = JSON.parse(raw) as AuditFilterValue;
        setFilter(parsed);
        setApplied(parsed);
      }
    } catch {
      /* ignore malformed persisted filter */
    }
  }, [storageKey]);

  const buildQuery = useCallback((f: AuditFilterValue, cursor?: string) => {
    const p = new URLSearchParams();
    if (f.from) p.set("from", f.from);
    if (f.to) p.set("to", f.to);
    if (f.actorId) p.set("actorId", f.actorId);
    if (f.actorRole) p.set("actorRole", f.actorRole);
    if (f.q) p.set("q", f.q);
    for (const a of f.actions) p.append("action", a);
    if (cursor) p.set("cursor", cursor);
    return p.toString();
  }, []);

  const load = useCallback(
    async (f: AuditFilterValue, cursor?: string) => {
      setLoading(true);
      try {
        const res = await fetch(`/api/bff/admin/audit?${buildQuery(f, cursor)}`);
        const json = await res.json();
        if (json.ok) {
          setEvents((prev) => (cursor ? [...prev, ...json.data.events] : json.data.events));
          setActions(json.data.actions ?? []);
          setNextCursor(json.data.nextCursor ?? null);
        }
      } finally {
        setLoading(false);
      }
    },
    [buildQuery],
  );

  useEffect(() => {
    void load(applied);
  }, [applied, load]);

  function apply() {
    try {
      localStorage.setItem(storageKey, JSON.stringify(filter));
    } catch {
      /* storage may be unavailable */
    }
    setApplied({ ...filter });
  }
  function reset() {
    const e = emptyFilter();
    setFilter(e);
    setApplied(e);
    try {
      localStorage.removeItem(storageKey);
    } catch {
      /* ignore */
    }
  }

  async function openDetail(e: AuditEventView) {
    setSelected(e);
    setProof(null);
    const res = await fetch(`/api/bff/admin/audit/${e.id}`);
    const json = await res.json();
    if (json.ok) {
      setSelected(json.data.event);
      setProof(json.data.proof ?? null);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <AuditFilterBarWrap value={filter} actions={actions} onChange={setFilter} onApply={apply} onReset={reset} />
      </div>
      <Card className="p-[var(--aivo-density-card-pad)]">
        <div className="mb-2 flex items-center justify-between">
          <p className="text-sm text-aivo-ink-soft">{loading ? t("loading") : t("result_count", { count: events.length })}</p>
          <ExportButton filter={applied} />
        </div>
        <div className="overflow-x-auto">
          <AuditTable events={events} onSelect={openDetail} />
        </div>
        {nextCursor ? (
          <div className="mt-3 flex justify-center">
            <Button type="button" variant="outline" size="sm" onClick={() => load(applied, nextCursor)} disabled={loading}>
              {t("load_more")}
            </Button>
          </div>
        ) : null}
      </Card>
      <AuditDetailDrawer event={selected} proof={proof} onClose={() => setSelected(null)} />
    </div>
  );
}

// Small wrapper so the filter bar spans full width above the table.
function AuditFilterBarWrap(props: Parameters<typeof AuditFilterBar>[0]) {
  return (
    <div className="w-full">
      <AuditFilterBar {...props} />
    </div>
  );
}
