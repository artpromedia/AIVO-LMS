"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { MoreVertical } from "lucide-react";

/**
 * Per-row "⋮" actions menu for the active-pilots table. Deep-links only to
 * routes that exist (the pilot read model and the owning tenant), so every
 * action is real. Accessible: a menu button with aria-haspopup/aria-expanded,
 * Escape to close, and click-outside to dismiss.
 */
export function PilotRowActions({
  tenantId,
  districtName,
}: {
  tenantId: string;
  districtName: string;
}) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onPointer(event: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(event.target as Node)) setOpen(false);
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={wrapRef} className="relative flex justify-end">
      <button
        type="button"
        className="inline-flex h-8 w-8 items-center justify-center rounded-full text-slate-500 hover:bg-slate-100 hover:text-slate-700"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`Actions for ${districtName}`}
        onClick={() => setOpen((value) => !value)}
        data-testid="pilot-row-actions-trigger"
      >
        <MoreVertical className="h-4 w-4" aria-hidden="true" />
      </button>
      {open ? (
        <div
          role="menu"
          className="absolute right-0 top-9 z-10 w-44 overflow-hidden rounded-xl border border-slate-200 bg-white py-1 shadow-lg"
        >
          <Link
            role="menuitem"
            href={`/platform/pilots/${tenantId}`}
            className="block px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
            onClick={() => setOpen(false)}
          >
            View pilot details
          </Link>
          <Link
            role="menuitem"
            href={`/platform/tenants/${tenantId}`}
            className="block px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
            onClick={() => setOpen(false)}
          >
            View tenant
          </Link>
        </div>
      ) : null}
    </div>
  );
}
