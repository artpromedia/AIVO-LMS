/**
 * SwitchScanController — a pure TypeScript (no DOM dependency) controller
 * for 1-switch or 2-switch scanning across a list of SymbolItems.
 */
import type { AACEvent, AACSessionConfig, SymbolItem } from "./types.js";

export class SwitchScanController {
  private items: SymbolItem[];
  private config: AACSessionConfig;
  private currentIndex: number = 0;
  private timer: ReturnType<typeof setInterval> | null = null;
  private subscribers: Array<(item: SymbolItem | null) => void> = [];

  constructor(config: AACSessionConfig, items: SymbolItem[]) {
    this.config = config;
    this.items = items;
  }

  start(): void {
    if (this.timer !== null) return;
    if (this.config.autoStart) {
      this.timer = setInterval(() => this.advance(), this.config.scanDelayMs);
    }
  }

  stop(): void {
    if (this.timer !== null) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  advance(): void {
    if (this.items.length === 0) return;
    this.currentIndex = (this.currentIndex + 1) % this.items.length;
    this._notify();
  }

  activate(): AACEvent {
    const item = this.getHighlightedItem();
    return {
      method: this.config.method === "switch_2" ? "switch_2" : "switch_1",
      targetId: item?.id ?? "",
      timestamp: Date.now(),
      scanStep: this.currentIndex,
    };
  }

  getHighlightedItem(): SymbolItem | null {
    if (this.items.length === 0) return null;
    return this.items[this.currentIndex] ?? null;
  }

  subscribe(cb: (item: SymbolItem | null) => void): () => void {
    this.subscribers.push(cb);
    return () => {
      this.subscribers = this.subscribers.filter((s) => s !== cb);
    };
  }

  private _notify(): void {
    const item = this.getHighlightedItem();
    for (const cb of this.subscribers) cb(item);
  }

  /** Implements AACInputAdapter.isAvailable — always true; software-only fallback. */
  static isAvailable(): boolean {
    return true;
  }

  get vendorName(): string {
    return "SwitchScanController";
  }
}
