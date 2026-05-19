// Tailwind v4 still picks up a config when one exists alongside `postcss.config.cjs`,
// which is how we layer the Inclusive-Lab Warm preset on top of the project's
// own utilities. The preset declares the `iw-*` semantic tokens (colors,
// radii, fonts, gradients) and the `brand-*` palette aliases that resolve to
// the CSS variables emitted by `@aivo/brand/tokens.css`. Without this file,
// every `bg-iw-bg`, `text-iw-ink`, `font-iw-display`, `rounded-iw-card`,
// etc. used during Sprint 2+ component migrations would silently produce
// no styles.
const brandPreset = require("@aivo/brand/tailwind-preset");

/** @type {import('tailwindcss').Config} */
module.exports = {
  presets: [brandPreset],
  content: ["./src/**/*.{ts,tsx}"],
};
