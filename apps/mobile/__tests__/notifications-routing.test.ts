/**
 * Pinned contract (Sprint A6): notification tap routing only ever lands on
 * the app's own allowlisted surfaces — a hostile or malformed payload
 * falls back to the root, never to an arbitrary path or external URL.
 */
import { describe, expect, it, vi } from "vitest";

vi.mock("react-native", () => ({ Platform: { OS: "ios" } }));
vi.mock("expo-notifications", () => ({}));
vi.mock("expo-secure-store", () => ({}));
vi.mock("expo-router", () => ({ router: { replace: vi.fn() } }));
vi.mock("@/lib/api", () => ({ apiFetch: vi.fn() }));
vi.mock("@/lib/sentry", () => ({ Sentry: { captureException: vi.fn() } }));
vi.mock("@/constants/api", () => ({ API: { COMMS: "https://comms.test" } }));

import { routeFromNotification } from "../lib/notifications";

describe("routeFromNotification", () => {
  it("routes allowlisted in-app paths", () => {
    expect(routeFromNotification({ path: "/messages" })).toBe("/messages");
    expect(routeFromNotification({ path: "/learner/homework/abc" })).toBe("/learner/homework/abc");
    expect(routeFromNotification({ path: "/parent" })).toBe("/parent");
  });

  it("falls back to root for unknown prefixes", () => {
    expect(routeFromNotification({ path: "/admin/secrets" })).toBe("/");
    expect(routeFromNotification({ path: "/evil" })).toBe("/");
  });

  it("rejects external/protocol-shaped values", () => {
    expect(routeFromNotification({ path: "https://evil.example.com" })).toBe("/");
    expect(routeFromNotification({ path: "//evil.example.com" })).toBe("/");
    expect(routeFromNotification({ path: "javascript://x" })).toBe("/");
  });

  it("tolerates missing/malformed data", () => {
    expect(routeFromNotification(undefined)).toBe("/");
    expect(routeFromNotification({})).toBe("/");
    expect(routeFromNotification({ path: 42 })).toBe("/");
  });
});
