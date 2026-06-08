/**
 * audit — memory == postgres parity (Sprint 1).
 * Append-only; reads are tenant-scoped and newest-first.
 */
import { it, expect } from "vitest";
import { recordAudit, recentAuditLogs, listAuditLogsForTenants } from "@/lib/db/repos";
import { runInBothModes } from "./parity.harness";

runInBothModes("audit", () => {
  it("recentForTenant returns the appended entry", async () => {
    await recordAudit({
      userId: "u_demo_parent",
      tenantId: "t_demo",
      action: "test.audit.parity",
      requestId: "req-audit-1",
    });
    const recent = await recentAuditLogs("t_demo", 50);
    expect(recent.some((l) => l.action === "test.audit.parity")).toBe(true);
  });

  it("recentForTenants includes only the requested tenant set", async () => {
    await recordAudit({
      userId: "u_demo_parent",
      tenantId: "t_demo",
      action: "audit.included",
      requestId: "req-audit-2",
    });
    await recordAudit({
      userId: "u_demo_parent",
      tenantId: "t_excluded",
      action: "audit.excluded",
      requestId: "req-audit-3",
    });
    const scoped = await listAuditLogsForTenants(["t_demo"], 100);
    expect(scoped.some((l) => l.action === "audit.included")).toBe(true);
    expect(scoped.some((l) => l.action === "audit.excluded")).toBe(false);
  });
});
