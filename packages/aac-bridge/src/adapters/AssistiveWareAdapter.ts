/**
 * AssistiveWareAdapter — Proloquo2Go integration via x-callback-url on iOS/iPadOS.
 *
 * INTEGRATION STATUS: Interface complete. Activation requires an iOS native
 * app bridge and a signed commercial agreement with AssistiveWare.
 * See packages/aac-bridge/docs/INTEGRATION_STATUS.md for details.
 */
import type { AACEvent, AACSessionConfig } from "../types.js";
import type { AACInputAdapter } from "./AACInputAdapter.js";

/**
 * Expected x-callback-url payload from Proloquo2Go (AssistiveWare developer docs):
 * aivo://aac-event?buttonId=<id>&label=<text>&boardId=<board>
 */
export class AssistiveWareAdapter implements AACInputAdapter {
  readonly vendorName = "AssistiveWare";

  private listeners: Array<(event: AACEvent) => void> = [];
  private _handler: ((e: Event) => void) | null = null;
  private _config: AACSessionConfig | null = null;

  isAvailable(): boolean {
    if (typeof navigator === "undefined") return false;
    const ua = navigator.userAgent ?? "";
    const isIOS = /iPad|iPhone|iPod/.test(ua);
    return isIOS;
  }

  async initialize(config: AACSessionConfig): Promise<void> {
    this._config = config;

    // Register a handler for the custom URL scheme callbacks from Proloquo2Go.
    // The native bridge is expected to dispatch a CustomEvent named
    // "proloquo2go-aac-event" on window when the user selects a symbol.
    this._handler = (e: Event) => {
      const detail = (e as CustomEvent<Record<string, string>>).detail;
      if (!detail) return;
      const evt: AACEvent = {
        method: this._config?.method ?? "touch",
        targetId: detail.buttonId ?? "",
        timestamp: Date.now(),
      };
      for (const cb of this.listeners) cb(evt);
    };

    if (typeof window !== "undefined") {
      window.addEventListener("proloquo2go-aac-event", this._handler);
    }
  }

  onEvent(cb: (event: AACEvent) => void): () => void {
    this.listeners.push(cb);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== cb);
    };
  }

  /**
   * Reverse-highlight a symbol on the Proloquo2Go board.
   *
   * Two delivery paths, in priority order:
   *   1. A native WKWebView message handler the iOS host app installs as
   *      `window.webkit.messageHandlers.proloquo2goHighlight`. The host
   *      performs the actual x-callback-url round-trip to Proloquo2Go — this
   *      keeps the web app in the foreground (no navigation away).
   *   2. Direct invocation of the AssistiveWare x-callback-url scheme, used
   *      when no native bridge is present (e.g. Proloquo2Go opened straight
   *      from Safari).
   *
   * No-ops off iOS / before initialization. Callers can probe
   * {@link supportsReverseHighlight} first.
   */
  highlight(targetId: string): void {
    if (!targetId || this._handler === null) return;
    if (typeof window === "undefined") return;

    const bridge = (window as unknown as Record<string, any>).webkit?.messageHandlers
      ?.proloquo2goHighlight;
    if (bridge?.postMessage) {
      bridge.postMessage({ targetId, highlightStyle: this._config?.highlightStyle ?? "box" });
      return;
    }

    // Per AssistiveWare developer docs, Proloquo2Go registers the
    // `proloquo2go://x-callback-url/highlight` route.
    const url =
      `proloquo2go://x-callback-url/highlight?id=${encodeURIComponent(targetId)}` +
      `&x-source=${encodeURIComponent("AIVO")}`;
    this._openCallbackUrl(url);
  }

  /** True when a reverse-highlight delivery path is available in this runtime. */
  supportsReverseHighlight(): boolean {
    if (!this.isAvailable() || typeof window === "undefined") return false;
    // On iOS the custom-scheme fallback is always available; the native bridge
    // is preferred when present.
    return true;
  }

  /**
   * Navigate to an x-callback-url. Isolated for testability (overridden by the
   * conformance harness so no real navigation occurs).
   * @internal
   */
  protected _openCallbackUrl(url: string): void {
    try {
      (window as unknown as { location: { href: string } }).location.href = url;
    } catch {
      /* navigation blocked (sandboxed iframe) — degrade silently */
    }
  }

  dispose(): void {
    if (this._handler && typeof window !== "undefined") {
      window.removeEventListener("proloquo2go-aac-event", this._handler);
    }
    this._handler = null;
    this.listeners = [];
    this._config = null;
  }

  /** Test/harness hook used by the conformance suite. */
  _emitForTest(evt: AACEvent): void {
    for (const cb of this.listeners) cb(evt);
  }
}
