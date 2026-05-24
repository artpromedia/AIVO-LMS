import { SurfaceHost, type SurfaceHostProps } from "./SurfaceHost.js";

/**
 * Backwards-compatible alias used by lesson-player integrations that route by
 * `item.surfaceType`.
 */
export function SurfaceRouter(props: SurfaceHostProps) {
  return <SurfaceHost {...props} />;
}
