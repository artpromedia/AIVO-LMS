"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import type { AuditFilterValue } from "./AuditFilterBar";

/** Builds the export URL from the active filter + format, triggers download. */
export function ExportButton({ filter }: { filter: AuditFilterValue }) {
  const t = useTranslations("admin.audit");
  const [open, setOpen] = useState(false);

  function href(format: "csv" | "json" | "ndjson"): string {
    const p = new URLSearchParams();
    p.set("format", format);
    if (filter.from) p.set("from", filter.from);
    if (filter.to) p.set("to", filter.to);
    if (filter.actorRole) p.set("actorRole", filter.actorRole);
    if (filter.q) p.set("q", filter.q);
    for (const a of filter.actions) p.append("action", a);
    return `/api/bff/admin/audit/export?${p.toString()}`;
  }

  return (
    <div className="relative inline-block">
      <Button type="button" variant="outline" size="sm" onClick={() => setOpen((o) => !o)} aria-expanded={open}>
        {t("export")}
      </Button>
      {open ? (
        <div className="absolute right-0 z-10 mt-1 w-36 rounded-md border border-aivo-border bg-aivo-surface p-1 shadow-md" role="menu">
          {(["csv", "json", "ndjson"] as const).map((fmt) => (
            <a
              key={fmt}
              role="menuitem"
              href={href(fmt)}
              download
              className="block rounded px-2 py-1 text-sm hover:bg-aivo-surface-2"
              onClick={() => setOpen(false)}
            >
              {t("export_as", { format: fmt.toUpperCase() })}
            </a>
          ))}
        </div>
      ) : null}
    </div>
  );
}
