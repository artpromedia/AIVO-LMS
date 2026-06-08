/**
 * support + settings — memory == postgres parity (Sprint 8).
 *
 * Support tickets (cross-tenant admin list + scoped status update), the
 * AI-generation job log, tenant settings (deep-merge patch), and the platform
 * settings catalogs.
 */
import { it, expect } from "vitest";
import {
  createSupportTicket,
  listSupportTickets,
  updateSupportTicketStatus,
  recordAiGenerationJob,
  listAiGenerationJobs,
  getTenantSettings,
  updateTenantSettings,
} from "@/lib/db/repos";
import { runInBothModes } from "./parity.harness";

const T = "t_support_parity";

runInBothModes("support+settings", () => {
  it("support ticket: create, cross-tenant list, scoped status update", async () => {
    const ticket = await createSupportTicket({
      userId: "u1",
      tenantId: T,
      subject: "Help",
      body: "Need help",
    });
    expect(ticket.status).toBe("open");
    const list = await listSupportTickets([T]);
    expect(list.some((x) => x.id === ticket.id)).toBe(true);
    // status update rejects out-of-scope tenants
    expect(await updateSupportTicketStatus(ticket.id, "resolved", { tenantIds: ["t_other"] })).toBeNull();
    const updated = await updateSupportTicketStatus(ticket.id, "resolved", { tenantIds: [T] });
    expect(updated?.status).toBe("resolved");
  });

  it("AI generation job log: append + tenant-scoped newest-first list", async () => {
    await recordAiGenerationJob({ tenantId: T, kind: "lesson_plan" as never, status: "complete" as never, inputRef: "in-1" });
    const jobs = await listAiGenerationJobs([T]);
    expect(jobs.some((j) => j.inputRef === "in-1")).toBe(true);
    expect((await listAiGenerationJobs(["t_other"])).length).toBe(0);
  });

  it("tenant settings: default materialization + deep-merge patch persists", async () => {
    const def = await getTenantSettings(T);
    expect(def.tenantId).toBe(T);
    const updated = await updateTenantSettings(T, { branding: { displayName: "Acme" } as never });
    expect((updated.branding as { displayName?: string }).displayName).toBe("Acme");
    // persisted
    const reread = await getTenantSettings(T);
    expect((reread.branding as { displayName?: string }).displayName).toBe("Acme");
  });
});
