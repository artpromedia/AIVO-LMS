/**
 * AACInputAdapter — the unified interface all vendor adapters must implement.
 */
import type { AACEvent, AACSessionConfig } from "../types.js";

export interface AACInputAdapter {
  readonly vendorName: string;
  /** Returns true if the vendor SDK is available in the current runtime. */
  isAvailable(): boolean;
  /** Initialise the adapter with the session config. */
  initialize(config: AACSessionConfig): Promise<void>;
  /** Subscribe to AAC events from the vendor device or controller. */
  onEvent(cb: (event: AACEvent) => void): () => void;
  /** Highlight a specific target on the vendor device (if supported). */
  highlight(targetId: string): void;
  /** Tear down all resources. */
  dispose(): void;
}
