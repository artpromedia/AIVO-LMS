/**
 * Colour helpers for the Pixi/WebGL brain visualisations. The brain
 * palette ships as CSS hex strings (`#E63946`) via
 * `state.visualIdentity`; Pixi shaders want either a packed 0xRRGGBB int
 * or normalised [r,g,b] floats. These convert between them defensively so
 * a malformed hue never crashes the render loop.
 */

/** Parse `#rgb` / `#rrggbb` (with or without leading `#`) to [r,g,b] in 0..255. */
export function hexToRgb255(hex: string): [number, number, number] {
  let h = hex.trim().replace(/^#/, "");
  if (h.length === 3) {
    h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
  }
  if (h.length !== 6 || /[^0-9a-fA-F]/.test(h)) {
    // Fall back to a calm violet so the shader still renders something sane.
    return [124, 58, 237];
  }
  const n = parseInt(h, 16);
  return [(n >> 16) & 0xff, (n >> 8) & 0xff, n & 0xff];
}

/** Normalised [r,g,b] floats in 0..1 — the form GLSL `vec3` colours expect. */
export function hexToRgbNorm(hex: string): [number, number, number] {
  const [r, g, b] = hexToRgb255(hex);
  return [r / 255, g / 255, b / 255];
}

/** Packed 0xRRGGBB integer for Pixi tints / fills. */
export function hexToInt(hex: string): number {
  const [r, g, b] = hexToRgb255(hex);
  return (r << 16) | (g << 8) | b;
}
