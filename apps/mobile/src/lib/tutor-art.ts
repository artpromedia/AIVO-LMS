/**
 * Bundled tutor portrait art (256px PNGs, derived from the canonical set in
 * packages/brand/assets/tutors). React Native requires static `require()`
 * calls, so the map is literal; the coverage test asserts it stays in
 * lockstep with the `TUTORS` catalogue — adding a 15th tutor without art
 * fails the suite instead of silently rendering an emoji.
 */
import type { ImageSourcePropType } from "react-native";
import type { TutorArtSlug } from "./tutor-art-manifest";

export const TUTOR_ART: Record<TutorArtSlug, ImageSourcePropType> = {
  nova: require("@/assets/images/tutors/nova.png"),
  sage: require("@/assets/images/tutors/sage.png"),
  spark: require("@/assets/images/tutors/spark.png"),
  chrono: require("@/assets/images/tutors/chrono.png"),
  pixel: require("@/assets/images/tutors/pixel.png"),
  echo: require("@/assets/images/tutors/echo.png"),
  harmony: require("@/assets/images/tutors/harmony.png"),
  atlas: require("@/assets/images/tutors/atlas.png"),
  cadence: require("@/assets/images/tutors/cadence.png"),
  compass: require("@/assets/images/tutors/compass.png"),
  forge: require("@/assets/images/tutors/forge.png"),
  lingua: require("@/assets/images/tutors/lingua.png"),
  muse: require("@/assets/images/tutors/muse.png"),
  vigor: require("@/assets/images/tutors/vigor.png"),
};

export function getTutorArt(slug: string): ImageSourcePropType | null {
  return (TUTOR_ART as Record<string, ImageSourcePropType>)[slug] ?? null;
}
