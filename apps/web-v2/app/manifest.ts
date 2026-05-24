import type { MetadataRoute } from "next";
import { INCLUSIVE_WARM_PALETTE } from "@aivo/brand";

/**
 * Sprint 11 — Learner PWA manifest.
 *
 * Installable surface points at `/learner/home` because that's the
 * landing page every authenticated learner hits. The icon assets reuse
 * the existing AIVO favicon-192 (purple AIVO mark) so we don't add
 * marketing-team work to ship this; richer maskable variants can be
 * dropped in later sprints. Colors come from `@aivo/brand` so the
 * install screen / OS theming match the in-app palette.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "AIVO Learning",
    short_name: "AIVO",
    description: "Personalized learning adventures for every child.",
    start_url: "/learner/home",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: INCLUSIVE_WARM_PALETTE.bgPage,
    theme_color: INCLUSIVE_WARM_PALETTE.primary,
    icons: [
      {
        src: "/images/favicon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
    ],
  };
}
