/**
 * LockedScreen — full-page "you can't enter this area" state.
 *
 * Driven by the `@aivo/nav` permission matrix: pass `role` + `area`
 * and it pulls the area meta, the lock reason, and an optional CTA
 * from the registry. Falls back to generic copy if a custom reason is
 * not supplied (which should not happen in practice).
 */
import * as React from "react";
import clsx from "clsx";
import { Lock } from "lucide-react";
import {
  NAV_AREA_META,
  ROLE_META,
  getPermission,
  type NavArea,
  type Role,
} from "@aivo/nav";
import { AivoIcon } from "../icon/AivoIcon.js";
import { NAV_ICON_TO_AIVO_ICON } from "./icon-map.js";

export interface LockedScreenProps {
  role: Role;
  area: NavArea;
  /** Anchor component for the CTA link. Defaults to `<a>`. */
  linkAs?: React.ElementType;
  className?: string;
}

export function LockedScreen({
  role,
  area,
  linkAs: LinkComponent = "a",
  className,
}: LockedScreenProps) {
  const meta = NAV_AREA_META[area];
  const perm = getPermission(role, area);
  const roleMeta = ROLE_META[role];

  const reason =
    perm.lockReason ??
    `As a ${roleMeta.label.toLowerCase()}, ${meta.label} is not part of your day-to-day in AIVO.`;
  const cta = perm.lockCta;

  return (
    <div
      className={clsx(
        "min-h-[60vh] flex items-center justify-center px-4 py-12",
        className,
      )}
    >
      <div className="max-w-md w-full rounded-iw-card-lg bg-white/85 backdrop-blur-md border border-iw-border shadow-iw-soft p-8 text-center flex flex-col items-center gap-4">
        <div className="relative flex h-16 w-16 items-center justify-center rounded-iw-hero bg-[var(--aivo-color-aivoPurple-50,#f5f3ff)]">
          <AivoIcon
            name={NAV_ICON_TO_AIVO_ICON[meta.icon]}
            tone="brand"
            className="h-7 w-7"
            aria-hidden
          />
          <span className="absolute -bottom-1 -right-1 flex h-6 w-6 items-center justify-center rounded-full bg-white shadow-iw-soft">
            <Lock className="h-3.5 w-3.5 text-iw-text-strong" aria-hidden />
          </span>
        </div>
        <div className="flex flex-col gap-2">
          <p className="iw-label text-iw-text-muted">{roleMeta.label} view</p>
          <h1 className="text-xl font-semibold text-iw-text-strong">
            {meta.label} is restricted here
          </h1>
          <p className="text-sm text-iw-text-muted">{reason}</p>
        </div>
        {cta ? (
          <LinkComponent
            href={cta.href ?? "#"}
            className="iw-touch inline-flex items-center justify-center rounded-iw-chip bg-[var(--aivo-sensory-primary,#7c3aed)] px-4 py-2 text-sm font-semibold text-white"
          >
            {cta.label}
          </LinkComponent>
        ) : null}
      </div>
    </div>
  );
}
LockedScreen.displayName = "Shell/LockedScreen";
