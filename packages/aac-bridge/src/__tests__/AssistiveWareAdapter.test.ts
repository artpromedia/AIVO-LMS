/**
 * Sprint 4 (production readiness) — AssistiveWare reverse-highlight.
 *
 * highlight() used to be a no-op TODO. It now delivers a reverse-highlight via
 * the native WKWebView message handler when present, falling back to the
 * Proloquo2Go x-callback-url scheme.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { AssistiveWareAdapter } from "../adapters/AssistiveWareAdapter.js";
import type { AACSessionConfig } from "../types.js";

const config: AACSessionConfig = {
  method: "touch",
  scanDelayMs: 1000,
  dwellTimeMs: 800,
  auditoryFeedback: false,
  highlightStyle: "glow",
  autoStart: false,
};

// Install minimal navigator/window globals (vitest "node" env has neither, and
// Node's global `navigator` is read-only so we go through vi.stubGlobal).
let win: Record<string, any>;

beforeEach(() => {
  vi.stubGlobal("navigator", { userAgent: "iPad; CPU OS 17_0 like Mac OS X" });
  win = { addEventListener: vi.fn(), removeEventListener: vi.fn() };
  vi.stubGlobal("window", win);
});
afterEach(() => {
  vi.unstubAllGlobals();
});

/** Subclass that captures x-callback-url navigations instead of performing them. */
class TestAdapter extends AssistiveWareAdapter {
  public opened: string[] = [];
  protected _openCallbackUrl(url: string): void {
    this.opened.push(url);
  }
}

describe("AssistiveWareAdapter.highlight", () => {
  it("no-ops before initialize", () => {
    const a = new TestAdapter();
    a.highlight("btn-1");
    expect(a.opened).toHaveLength(0);
  });

  it("prefers the native WKWebView message handler when present", async () => {
    const post = vi.fn();
    win.webkit = { messageHandlers: { proloquo2goHighlight: { postMessage: post } } };
    const a = new TestAdapter();
    await a.initialize(config);
    a.highlight("btn-42");
    expect(post).toHaveBeenCalledWith({ targetId: "btn-42", highlightStyle: "glow" });
    expect(a.opened).toHaveLength(0); // bridge path, no URL navigation
  });

  it("falls back to the x-callback-url scheme without a native bridge", async () => {
    const a = new TestAdapter();
    await a.initialize(config);
    a.highlight("btn 7");
    expect(a.opened).toHaveLength(1);
    expect(a.opened[0]).toContain("proloquo2go://x-callback-url/highlight");
    expect(a.opened[0]).toContain("id=btn%207"); // url-encoded
    expect(a.opened[0]).toContain("x-source=AIVO");
  });

  it("reports reverse-highlight capability on iOS", async () => {
    const a = new TestAdapter();
    await a.initialize(config);
    expect(a.supportsReverseHighlight()).toBe(true);
  });

  it("reports no capability off iOS", () => {
    vi.stubGlobal("navigator", { userAgent: "Mozilla/5.0 (Windows NT 10.0)" });
    const a = new TestAdapter();
    expect(a.supportsReverseHighlight()).toBe(false);
  });
});
