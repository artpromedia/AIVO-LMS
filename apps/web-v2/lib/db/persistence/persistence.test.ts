/**
 * Persistence adapter — smoke tests.
 *
 * The notifications domain is the first migrated through the adapter
 * (ADR 0007). These tests pin:
 *   - `getPersistence()` returns the memory adapter by default.
 *   - `notifications` list/markRead/create/listDeliveries go through
 *     the adapter and remain semantically identical to the legacy
 *     repo-direct implementations.
 */
import { describe, it, expect, beforeEach } from "vitest";
import { ensureSeeded } from "@/lib/db/seed";
import { resetStore } from "@/lib/db/store";
import {
  createNotification,
  listAuditLogsForTenants,
  listDeliveriesFor,
  listNotifications,
  markNotificationsRead,
  recentAuditLogs,
  recordAudit,
} from "@/lib/db/repos";
import { getPersistence, resetPersistence } from "@/lib/db/persistence";

describe("persistence adapter — notifications (memory)", () => {
  beforeEach(() => {
    resetStore();
    ensureSeeded();
    resetPersistence();
  });

  it("defaults to memory mode", () => {
    const p = getPersistence();
    expect(p.mode).toBe("memory");
  });

  it("create + list returns the inserted row", async () => {
    const { notification } = await createNotification({
      tenantId: "t_demo",
      userId: "u_demo_parent",
      type: "parent_progress_summary",
      title: "Weekly snapshot",
      body: "Sky finished 3 lessons this week.",
      href: null,
      learnerId: null,
    });
    const all = await listNotifications({
      tenantId: "t_demo",
      userId: "u_demo_parent",
    });
    expect(all.some((n) => n.id === notification.id)).toBe(true);
  });

  it("listNotifications respects unreadOnly", async () => {
    const { notification } = await createNotification({
      tenantId: "t_demo",
      userId: "u_demo_parent",
      type: "parent_progress_summary",
      title: "Unread one",
      body: ".",
      href: null,
      learnerId: null,
    });
    const before = await listNotifications({
      tenantId: "t_demo",
      userId: "u_demo_parent",
      unreadOnly: true,
    });
    expect(before.some((n) => n.id === notification.id)).toBe(true);
    const flipped = await markNotificationsRead("u_demo_parent", "t_demo", [notification.id]);
    expect(flipped).toBe(1);
    const after = await listNotifications({
      tenantId: "t_demo",
      userId: "u_demo_parent",
      unreadOnly: true,
    });
    expect(after.some((n) => n.id === notification.id)).toBe(false);
  });

  it("listDeliveriesFor returns one row per channel", async () => {
    const { notification } = await createNotification({
      tenantId: "t_demo",
      userId: "u_demo_parent",
      type: "parent_progress_summary",
      title: "Delivery test",
      body: ".",
      href: null,
      learnerId: null,
    });
    const deliveries = await listDeliveriesFor(notification.id);
    // in_app, email, push are the three canonical channels.
    expect(deliveries.length).toBe(3);
  });

  it("audit append + recentForTenant round-trips", async () => {
    await recordAudit({
      userId: "u_demo_parent",
      tenantId: "t_demo",
      action: "test.audit.entry",
      requestId: "req-test-1",
    });
    const recent = await recentAuditLogs("t_demo", 50);
    expect(recent.some((l) => l.action === "test.audit.entry")).toBe(true);
  });

  it("audit recentForTenants filters by tenant set", async () => {
    await recordAudit({
      userId: "u_demo_parent",
      tenantId: "t_demo",
      action: "test.audit.scope.included",
      requestId: "req-test-2",
    });
    await recordAudit({
      userId: "u_demo_parent",
      tenantId: "t_other",
      action: "test.audit.scope.excluded",
      requestId: "req-test-3",
    });
    const scoped = await listAuditLogsForTenants(["t_demo"], 100);
    expect(scoped.some((l) => l.action === "test.audit.scope.included")).toBe(true);
    expect(scoped.some((l) => l.action === "test.audit.scope.excluded")).toBe(false);
  });

  it("markNotificationsRead does not bleed across tenants", async () => {
    const { notification } = await createNotification({
      tenantId: "t_demo",
      userId: "u_demo_parent",
      type: "parent_progress_summary",
      title: "Scoped read",
      body: ".",
      href: null,
      learnerId: null,
    });
    const otherTenant = await markNotificationsRead(
      "u_demo_parent",
      "t_some_other_tenant",
      [notification.id],
    );
    expect(otherTenant).toBe(0);
  });
});
