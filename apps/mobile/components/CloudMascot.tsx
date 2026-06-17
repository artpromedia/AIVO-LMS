// CloudMascot — the friendly smiling cloud from the AIVO splash design.
//
// Drawn with react-native-svg (no raster asset) so it scales crisply at any
// size, themes cleanly, and can be animated by its parent. The cloud body is
// a cluster of overlapping puffs with a soft white→lavender gradient and a
// gentle face; a soft purple halo behind it gives the "glowing" splash look.

import React from "react";
import Svg, {
  Defs,
  LinearGradient,
  RadialGradient,
  Stop,
  Ellipse,
  Circle,
  Path,
  G,
} from "react-native-svg";

interface CloudMascotProps {
  /** Rendered width in points. Height derives from a 4:3 aspect ratio. */
  width?: number;
  /** Eyes/mouth colour — deep indigo so the face reads on the white cloud. */
  faceColor?: string;
}

export function CloudMascot({ width = 150, faceColor = "#2A1E63" }: CloudMascotProps) {
  const height = Math.round((width * 3) / 4);
  return (
    <Svg width={width} height={height} viewBox="0 0 120 90" accessibilityRole="image">
      <Defs>
        <LinearGradient id="cloudBody" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor="#FFFFFF" />
          <Stop offset="1" stopColor="#E7E0FF" />
        </LinearGradient>
        <RadialGradient id="cloudHalo" cx="0.5" cy="0.5" r="0.5">
          <Stop offset="0" stopColor="#9B7CFF" stopOpacity="0.55" />
          <Stop offset="1" stopColor="#9B7CFF" stopOpacity="0" />
        </RadialGradient>
      </Defs>

      {/* Soft glow behind the cloud. */}
      <Ellipse cx="60" cy="50" rx="58" ry="44" fill="url(#cloudHalo)" />

      {/* Cloud body — overlapping puffs sharing one fill read as a single blob. */}
      <G fill="url(#cloudBody)">
        <Ellipse cx="60" cy="60" rx="44" ry="20" />
        <Circle cx="36" cy="50" r="19" />
        <Circle cx="62" cy="40" r="25" />
        <Circle cx="86" cy="51" r="17" />
      </G>

      {/* Face. */}
      <G>
        <Ellipse cx="51" cy="48" rx="3.4" ry="4.8" fill={faceColor} />
        <Ellipse cx="71" cy="48" rx="3.4" ry="4.8" fill={faceColor} />
        <Path
          d="M50 58 Q61 67 72 58"
          stroke={faceColor}
          strokeWidth="3"
          strokeLinecap="round"
          fill="none"
        />
      </G>
    </Svg>
  );
}
