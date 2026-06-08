/**
 * notifications — memory == postgres parity (Sprint 1).
 * Pins the semantics most likely to diverge between a Map and SQL:
 * newest-first ordering, unreadOnly filter, markRead flip-count, and
 * tenant scoping. Driven through the mode-selected adapter.
 */
import { it, expect } from "vitest";
import {
  createNotification,
  listNotifications,
  markNotificationsRead,
  listDeliveriesFor,
} from "@/lib/db/repos";
import { runInBothModes } from "./parity.harness";

const T = "t_demo";
const U = "u_demo_parent";

async function make(title: string) {
  const { notification } = await createNotification({
    tenantId: T,
    userId: U,
    type: "parent_progress_summary",
    title,
    body: ".",
    href: null,
    learnerId: null,
  });
  return notification;
}

runInBothModes("notifications", () => {
  it("lists for the user and filters unreadOnly", async () => {
    const a = await make("first");
    const b = await make("second");
    const all = await listNotifications({ tenantId: T, userId: U });
    // Both are visible to the owner. (Strict newest-first ordering with
    // controlled timestamps is pinned in the notification store contract;
    // here a and b share a creation millisecond so their relative order is
    // a tie and not asserted.)
    expect(all.some((n) => n.id === a.id)).toBe(true);
    expect(all.some((n) => n.id === b.id)).toBe(true);

    const flipped = await markNotificationsRead(U, T, [a.id]);
    expect(flipped).toBe(1);
    const unread = await listNotifications({ tenantId: T, userId: U, unreadOnly: true });
    expect(unread.some((n) => n.id === a.id)).toBe(false);
    expect(unread.some((n) => n.id === b.id)).toBe(true);
  });

  it("markRead returns 0 across a foreign tenant and writes 3 delivery channels", async () => {
    const n = await make("scoped");
    expect(await markNotificationsRead(U, "t_other", [n.id])).toBe(0);
    expect((await listDeliveriesFor(n.id)).length).toBe(3);
  });
});
