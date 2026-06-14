/**
 * Web export Sentry shim.
 *
 * Expo's web bundler cannot include @sentry/react-native because that package
 * imports native React Native internals. Native builds use sentry.ts; web export
 * receives this platform file instead so CI can build the static web preview
 * without bundling native-only telemetry code.
 */

export function initSentry(): void {
  // Native-only telemetry is intentionally disabled for Expo web export.
}

export const Sentry = {
  captureException: (_error: unknown, _context?: unknown) => undefined,
  captureMessage: (_message: string, _level?: string) => undefined,
};
