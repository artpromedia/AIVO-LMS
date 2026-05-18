/**
 * PRCSaltilloAdapter — wraps the PRC-Saltillo LAMP/SnapCore web integration bridge.
 *
 * The SDK is injected by the Snap Core First web integration layer as
 * window.__LAMP_SDK or window.__SnapCore. If neither is present the adapter
 * is unavailable and all methods are safe no-ops.
 */
import type { AACEvent, AACSessionConfig } from "../types.js";
import type { AACInputAdapter } from "./AACInputAdapter.js";

const PRC_APP_ID =
  typeof process !== "undefined" ? (process.env.PRC_APP_ID ?? "aivo-dev") : "aivo-dev";

export class PRCSaltilloAdapter implements AACInputAdapter {
  readonly vendorName = "PRC-Saltillo";

  private listeners: Array<(event: AACEvent) => void> = [];
  private _unsub: (() => void) | null = null;
  private _initialized = false;

  isAvailable(): boolean {
    if (typeof window === "undefined") return false;
    return !!((window as any).__LAMP_SDK || (window as any).__SnapCore);
  }

  async initialize(config: AACSessionConfig): Promise<void> {
    if (!this.isAvailable()) {
      console.warn("[PRCSaltilloAdapter] SDK not present — operating as no-op");
      return;
    }
    const sdk = (window as any).__LAMP_SDK ?? (window as any).__SnapCore;
    try {
      await sdk.init?.({ appId: PRC_APP_ID });
    } catch {
      // SDK init is best-effort; do not throw.
    }

    const onSymbol = (detail: any) => {
      const evt: AACEvent = {
        method: config.method,
        targetId: String(detail?.buttonId ?? detail?.id ?? ""),
        timestamp: Date.now(),
      };
      for (const cb of this.listeners) cb(evt);
    };

    sdk.addEventListener?.("symbolActivated", onSymbol);
    sdk.addEventListener?.("scannerMoved", onSymbol);
    this._unsub = () => {
      sdk.removeEventListener?.("symbolActivated", onSymbol);
      sdk.removeEventListener?.("scannerMoved", onSymbol);
    };
    this._initialized = true;
  }

  onEvent(cb: (event: AACEvent) => void): () => void {
    this.listeners.push(cb);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== cb);
    };
  }

  highlight(_targetId: string): void {
    if (!this._initialized) return;
    const sdk = (window as any).__LAMP_SDK ?? (window as any).__SnapCore;
    sdk?.highlight?.(_targetId);
  }

  dispose(): void {
    this._unsub?.();
    this._unsub = null;
    this.listeners = [];
    this._initialized = false;
  }

  /** Test/harness hook used by the conformance suite. */
  _emitForTest(evt: AACEvent): void {
    for (const cb of this.listeners) cb(evt);
  }
}
