import {
  NormalizedExportSisProvider,
  type NormalizedRosterExport,
  type SisProvider,
} from "./sis-provider-interface.js";

/**
 * Clever-compatible import adapter. Accepts a normalized JSON export
 * (matching the Clever schema shape) and exposes it through the
 * SisProvider interface. Live Clever API integration plugs into this
 * adapter without changing routes or schemas.
 */
export function createCleverAdapterFromExport(exportPayload: NormalizedRosterExport): SisProvider {
  return new NormalizedExportSisProvider("clever", exportPayload);
}
