import { describe, expect, it } from "vitest";
import { safeNextPath } from "./safe-redirect";

describe("safeNextPath", () => {
  it("accepts same-origin absolute paths", () => {
    expect(safeNextPath("/platform/users")).toBe("/platform/users");
    expect(safeNextPath("/district?tab=schools")).toBe("/district?tab=schools");
  });

  it("rejects absolute URLs", () => {
    expect(safeNextPath("https://evil.example.com/")).toBe("/");
    expect(safeNextPath("http://evil.example.com")).toBe("/");
  });

  it("rejects protocol-relative URLs", () => {
    expect(safeNextPath("//evil.example.com/path")).toBe("/");
  });

  it("rejects javascript: and other scheme smuggling", () => {
    expect(safeNextPath("javascript:alert(1)")).toBe("/");
    expect(safeNextPath("/redirect:javascript:alert(1)")).toBe("/");
  });

  it("rejects backslash and empty/oversized values", () => {
    expect(safeNextPath("/\\evil.example.com")).toBe("/");
    expect(safeNextPath("")).toBe("/");
    expect(safeNextPath("/" + "a".repeat(2000))).toBe("/");
    expect(safeNextPath(null)).toBe("/");
  });

  it("honors a custom fallback", () => {
    expect(safeNextPath("https://evil.example.com", "/login")).toBe("/login");
  });
});
