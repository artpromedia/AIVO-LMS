/**
 * AccessDeniedScreen — 403 page for routes that exist but the current
 * role isn't permitted to view (e.g. a parent following a deep link
 * into the school admin area).
 */
import * as React from "react";
import clsx from "clsx";
import { ShieldAlert } from "lucide-react";
import { ROLE_META, type Role } from "@aivo/nav";

export interface AccessDeniedScreenProps {
  /** Role the user is currently signed in as. */
  role: Role;
  /** Optional path the user tried to reach, for diagnostics. */
  attemptedPath?: string;
  /** Optional CTA shown below the message. */
  action?: React.ReactNode;
  className?: string;
}

export function AccessDeniedScreen({
  role,
  attemptedPath,
  action,
  className,
}: AccessDeniedScreenProps) {
  return (
    <div
      className={clsx(
        "min-h-[60vh] flex items-center justify-center px-4 py-12",
        className,
      )}
    >
      <div className="max-w-md w-full rounded-iw-card-lg bg-white/85 backdrop-blur-md border border-iw-border shadow-iw-soft p-8 text-center flex flex-col items-center gap-4">
        <div className="flex h-16 w-16 items-center justify-center rounded-iw-hero bg-[var(--aivo-color-status-warning-subtle,#fffbeb)]">
          <ShieldAlert
            className="h-7 w-7 text-[var(--aivo-color-status-warning-strong,#b45309)]"
            aria-hidden
          />
        </div>
        <div className="flex flex-col gap-2">
          <h1 className="text-xl font-semibold text-iw-text-strong">
            You don't have access to this page
          </h1>
          <p className="text-sm text-iw-text-muted">
            Your current role ({ROLE_META[role].label}) doesn't include the
            requested area. Switch roles from the top bar if you have another
            account on AIVO, or ask an admin to grant access.
          </p>
          {attemptedPath ? (
            <p className="text-xs text-iw-text-muted">
              <span className="font-mono">{attemptedPath}</span>
            </p>
          ) : null}
        </div>
        {action ? <div className="pt-1">{action}</div> : null}
      </div>
    </div>
  );
}
AccessDeniedScreen.displayName = "Shell/AccessDeniedScreen";
