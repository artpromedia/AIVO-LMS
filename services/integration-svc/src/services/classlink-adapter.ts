import {
  NormalizedExportSisProvider,
  type NormalizedRosterExport,
  type SisProvider,
} from "./sis-provider-interface.js";

/**
 * ClassLink-compatible import adapter. Accepts a normalized JSON export
 * (matching the ClassLink schema shape) and exposes it through the
 * SisProvider interface.
 */
export function createClassLinkAdapterFromExport(
  exportPayload: NormalizedRosterExport,
): SisProvider {
  return new NormalizedExportSisProvider("classlink", exportPayload);
}
