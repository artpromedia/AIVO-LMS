/**
 * Alert dedupe + routing (Sprint 8).
 *
 * Alertmanager can fire the same alert repeatedly while a condition holds.
 * We dedupe by a stable fingerprint (alertname + labels) within a window
 * so we page once per incident, not once per scrape. Routing picks a
 * severity → channel mapping and a per-tenant label.
 */
import { createHash } from "node:crypto";

export interface PromAlert {
  status: "firing" | "resolved";
  labels: Record<string, string>;
  annotations?: Record<string, string>;
  startsAt?: string;
  endsAt?: string;
  fingerprint?: string;
}

export function fingerprintOf(alert: PromAlert): string {
  if (alert.fingerprint) return alert.fingerprint;
  const labelKey = Object.keys(alert.labels)
    .sort()
    .map((k) => `${k}=${alert.labels[k]}`)
    .join(",");
  return createHash("sha256").update(labelKey).digest("hex").slice(0, 16);
}

export interface DedupeEntry {
  fingerprint: string;
  firstSeen: number;
  lastSeen: number;
  count: number;
  status: PromAlert["status"];
}

export class AlertDeduper {
  private readonly windowMs: number;
  private readonly seen = new Map<string, DedupeEntry>();

  constructor(windowMs = 5 * 60_000) {
    this.windowMs = windowMs;
  }

  /**
   * Returns true when this alert is NEW (should be routed/paged) and false
   * when it is a duplicate within the window. A "resolved" status for a
   * previously firing fingerprint is always considered actionable.
   */
  accept(alert: PromAlert, now = Date.now()): boolean {
    const fp = fingerprintOf(alert);
    const existing = this.seen.get(fp);

    if (!existing) {
      this.seen.set(fp, {
        fingerprint: fp,
        firstSeen: now,
        lastSeen: now,
        count: 1,
        status: alert.status,
      });
      return true;
    }

    // Status transition (firing→resolved or back) is always actionable.
    if (existing.status !== alert.status) {
      existing.status = alert.status;
      existing.lastSeen = now;
      existing.count += 1;
      return true;
    }

    // Same status within window → duplicate.
    if (now - existing.lastSeen < this.windowMs) {
      existing.lastSeen = now;
      existing.count += 1;
      return false;
    }

    // Window elapsed → treat as a fresh occurrence.
    existing.lastSeen = now;
    existing.count += 1;
    return true;
  }

  entry(alert: PromAlert): DedupeEntry | undefined {
    return this.seen.get(fingerprintOf(alert));
  }

  /** Drop entries older than the window to bound memory. */
  prune(now = Date.now()): void {
    for (const [fp, e] of this.seen) {
      if (now - e.lastSeen > this.windowMs) this.seen.delete(fp);
    }
  }
}

export type RouteSeverity = "critical" | "warning" | "info";

export function severityFromAlert(alert: PromAlert): RouteSeverity {
  const s = alert.labels.severity?.toLowerCase();
  if (s === "critical" || s === "page") return "critical";
  if (s === "warning" || s === "warn") return "warning";
  return "info";
}

export function tenantFromAlert(alert: PromAlert): string | null {
  return alert.labels.tenant_id ?? alert.labels.tenant ?? null;
}
