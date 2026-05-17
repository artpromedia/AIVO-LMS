/**
 * AdapterFactory — auto-detects and instantiates the best available AACInputAdapter
 * for the current runtime and session configuration.
 */
import type { AACSessionConfig, SymbolItem } from "../types.js";
import type { AACInputAdapter } from "./AACInputAdapter.js";
import { SwitchScanController } from "../SwitchScanController.js";
import { TobiiAdapter } from "./TobiiAdapter.js";
import { AssistiveWareAdapter } from "./AssistiveWareAdapter.js";
import { PRCSaltilloAdapter } from "./PRCSaltilloAdapter.js";

/**
 * Wraps SwitchScanController to satisfy the AACInputAdapter interface.
 */
class SwitchScanAdapter implements AACInputAdapter {
  readonly vendorName = "SwitchScanController";
  private controller: SwitchScanController;

  constructor(private config: AACSessionConfig, private items: SymbolItem[]) {
    this.controller = new SwitchScanController(config, items);
  }

  isAvailable(): boolean {
    return SwitchScanController.isAvailable();
  }

  async initialize(_config: AACSessionConfig): Promise<void> {
    this.controller = new SwitchScanController(this.config, this.items);
    this.controller.start();
  }

  onEvent(cb: (e: ReturnType<SwitchScanController["activate"]>) => void): () => void {
    return this.controller.subscribe((_item) => {
      cb(this.controller.activate());
    });
  }

  highlight(targetId: string): void {
    // SwitchScanController advances automatically; manual highlight not applicable.
    void targetId;
  }

  dispose(): void {
    this.controller.stop();
  }
}

/** @internal — exported for testing purposes */
export function _makeSwitchAdapter(config: AACSessionConfig, items: SymbolItem[]): AACInputAdapter {
  return new SwitchScanAdapter(config, items);
}

/**
 * Detects and creates the best available adapter for the given config.
 *
 * Priority order:
 * 1. eye_gaze → TobiiAdapter
 * 2. switch_1 / switch_2 → SwitchScanController adapter
 * 3. Proloquo2Go (AssistiveWare) if iOS
 * 4. PRC-Saltillo if SDK present
 * 5. Fallback → SwitchScanController (software-only, always available)
 */
export function detectAndCreateAdapter(
  config: AACSessionConfig,
  items: SymbolItem[] = [],
): AACInputAdapter {
  if (config.method === "eye_gaze") {
    const tobii = new TobiiAdapter();
    if (tobii.isAvailable()) {
      console.info("[aac-bridge] Selected adapter: Tobii");
      return tobii;
    }
  }

  if (config.method === "switch_1" || config.method === "switch_2") {
    console.info("[aac-bridge] Selected adapter: SwitchScanController");
    return _makeSwitchAdapter(config, items);
  }

  const assistive = new AssistiveWareAdapter();
  if (assistive.isAvailable()) {
    console.info("[aac-bridge] Selected adapter: AssistiveWare");
    return assistive;
  }

  const prc = new PRCSaltilloAdapter();
  if (prc.isAvailable()) {
    console.info("[aac-bridge] Selected adapter: PRC-Saltillo");
    return prc;
  }

  console.info("[aac-bridge] Selected adapter: SwitchScanController (fallback)");
  return _makeSwitchAdapter(config, items);
}

/**
 * Returns the vendorName of every adapter whose isAvailable() returns true
 * in the current runtime.
 */
export function listAvailableAdapters(): string[] {
  const candidates: AACInputAdapter[] = [
    new TobiiAdapter(),
    new AssistiveWareAdapter(),
    new PRCSaltilloAdapter(),
    // SwitchScanController is always available.
    { vendorName: "SwitchScanController", isAvailable: () => true } as unknown as AACInputAdapter,
  ];
  return candidates.filter((a) => a.isAvailable()).map((a) => a.vendorName);
}
