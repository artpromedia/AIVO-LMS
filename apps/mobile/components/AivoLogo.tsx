// AivoLogo — single source of truth for the AIVO wordmark/logo on
// mobile. Brand spec ships three variants: `purple` (default, for
// light surfaces), `dark` (deep-ink variant for high-contrast
// light backgrounds), and `white` (for the dark capsule nav and
// dark heroes). All three PNGs are bundled.

import React from "react";
import { Image, type ImageStyle, type StyleProp } from "react-native";

export type AivoLogoVariant = "purple" | "dark" | "white";

const PURPLE_PNG = require("@/assets/images/aivo-logo-purple.png");
const DARK_PNG = require("@/assets/images/aivo-logo-dark.png");
const WHITE_PNG = require("@/assets/images/aivo-logo-white.png");

const SOURCES: Record<AivoLogoVariant, number> = {
  purple: PURPLE_PNG,
  dark: DARK_PNG,
  white: WHITE_PNG,
};

interface AivoLogoProps {
  variant?: AivoLogoVariant;
  /** Rendered width in points. Height auto-derives from a 3:1 aspect
   *  ratio matching the source PNGs. */
  width?: number;
  style?: StyleProp<ImageStyle>;
  accessibilityLabel?: string;
}

export function AivoLogo({
  variant = "purple",
  width = 120,
  style,
  accessibilityLabel = "AIVO",
}: AivoLogoProps) {
  const height = Math.round(width / 3);
  return (
    <Image
      source={SOURCES[variant]}
      accessibilityLabel={accessibilityLabel}
      accessible
      resizeMode="contain"
      style={[{ width, height }, style]}
    />
  );
}
