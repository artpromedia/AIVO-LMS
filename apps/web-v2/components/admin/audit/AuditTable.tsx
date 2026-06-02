"use client";

import { useTranslations } from "next-intl";
import { Badge } from "@/components/ui/badge";
import type { AuditEventView } from "@/lib/db/audit-store";

/**
 * Audit event table — columns: time, actor, action, entity, outcome, IP.
 * Row activation opens the detail drawer. (Kept simple here; a windowing
 * lib would be layered in for very large in-memory result sets.)
 */
export function AuditTable({
  events,
  onSelect,
}: {
  events: AuditEventView[];
  onSelect: (e: AuditEventView) => void;
}) {
  const t = useTranslations("admin.audit");
  if (events.length === 0) {
    return <p className="text-sm text-aivo-ink-soft">{t("empty")}</p>;
  }
  return (
    <table className="w-full text-sm">
      <caption className="sr-only">{t("table_caption")}</caption>
      <thead>
        <tr className="text-left text-xs text-aivo-ink-soft">
          <th scope="col" className="py-1">{t("col_time")}</th>
          <th scope="col">{t("col_actor")}</th>
          <th scope="col">{t("col_action")}</th>
          <th scope="col">{t("col_entity")}</th>
          <th scope="col">{t("col_outcome")}</th>
          <th scope="col">{t("col_ip")}</th>
        </tr>
      </thead>
      <tbody>
        {events.map((e) => (
          <tr
            key={e.id}
            tabIndex={0}
            role="button"
            aria-label={t("open_detail", { action: e.action })}
            className="cursor-pointer border-t border-aivo-border hover:bg-aivo-surface-2 focus:bg-aivo-surface-2 focus:outline-none"
            onClick={() => onSelect(e)}
            onKeyDown={(ev) => {
              if (ev.key === "Enter" || ev.key === " ") {
                ev.preventDefault();
                onSelect(e);
              }
            }}
          >
            <td className="py-1 whitespace-nowrap">{new Date(e.occurred_at).toLocaleString()}</td>
            <td>
              <span className="font-medium">{e.actor.id}</span>{" "}
              <span className="text-xs text-aivo-ink-soft">{e.actor.role}</span>
            </td>
            <td><code className="text-xs">{e.action}</code></td>
            <td className="text-xs">{e.entity.type}/{e.entity.id}</td>
            <td><Badge tone={e.outcome === "success" ? "success" : "danger"}>{e.outcome}</Badge></td>
            <td className="text-xs">{e.actor.ip}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
