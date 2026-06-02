"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import type { AuditEventView } from "@/lib/db/audit-store";

export type AuditProof = { prev_hash: string; hash: string; next_hash: string | null } | null;

/**
 * Right-side detail panel: full event payload, prev/next hash-chain proof
 * (when the viewer is permitted), and copy-as-JSON.
 */
export function AuditDetailDrawer({
  event,
  proof,
  onClose,
}: {
  event: AuditEventView | null;
  proof: AuditProof;
  onClose: () => void;
}) {
  const t = useTranslations("admin.audit");
  const [copied, setCopied] = useState(false);
  if (!event) return null;

  function copy() {
    navigator.clipboard?.writeText(JSON.stringify(event, null, 2)).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={t("detail_title")}
      className="fixed inset-y-0 right-0 z-50 flex w-full max-w-md flex-col gap-4 overflow-y-auto border-l border-aivo-border bg-aivo-surface p-5 shadow-xl"
    >
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="font-display text-lg font-semibold">{t("detail_title")}</p>
          <code className="text-xs text-aivo-ink-soft">{event.id}</code>
        </div>
        <Button type="button" variant="ghost" size="sm" onClick={onClose} aria-label={t("close")}>✕</Button>
      </div>

      <dl className="space-y-2 text-sm">
        <Row k={t("col_time")} v={new Date(event.occurred_at).toLocaleString()} />
        <Row k={t("col_action")} v={event.action} mono />
        <Row k={t("col_actor")} v={`${event.actor.id} · ${event.actor.role}`} />
        <Row k={t("col_entity")} v={`${event.entity.type}/${event.entity.id}`} />
        <Row k={t("col_outcome")} v={event.outcome} />
        <Row k={t("col_ip")} v={event.actor.ip} />
        <Row k={t("request_id")} v={event.request_id} mono />
      </dl>

      <div>
        <p className="text-sm font-medium">{t("details_payload")}</p>
        <pre className="mt-1 max-h-48 overflow-auto rounded bg-aivo-surface-2 p-2 text-xs">
          {JSON.stringify(event.details, null, 2)}
        </pre>
      </div>

      {proof ? (
        <div>
          <p className="text-sm font-medium">{t("hash_chain")}</p>
          <dl className="mt-1 space-y-1 text-xs">
            <Row k={t("prev_hash")} v={proof.prev_hash || "—"} mono />
            <Row k={t("this_hash")} v={proof.hash} mono />
            <Row k={t("next_hash")} v={proof.next_hash ?? t("chain_head")} mono />
          </dl>
        </div>
      ) : (
        <p className="text-xs text-aivo-ink-soft">{t("proof_hidden")}</p>
      )}

      <div className="mt-auto flex justify-end">
        <Button type="button" variant="outline" size="sm" onClick={copy}>
          {copied ? t("copied") : t("copy_json")}
        </Button>
      </div>
    </div>
  );
}

function Row({ k, v, mono }: { k: string; v: string; mono?: boolean }) {
  return (
    <div className="flex justify-between gap-3">
      <dt className="shrink-0 text-aivo-ink-soft">{k}</dt>
      <dd className={`text-right break-all ${mono ? "font-mono text-xs" : ""}`}>{v}</dd>
    </div>
  );
}
