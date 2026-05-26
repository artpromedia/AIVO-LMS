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

  highlight(_targetId: string): void {
    // TODO(sprint-15-followup): Implement reverse highlighting via the
    // AssistiveWare x-callback-url scheme once the native iOS bridge ships.
    // The gap was noted in the packages audit accompanying Sprint 15 and is
    // intentionally deferred to a follow-up issue so this sprint isn't
    // blocked on Proloquo2Go's commercial agreement + native bridge work.
    // Tracked in packages/aac-bridge/docs/INTEGRATION_STATUS.md.
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
