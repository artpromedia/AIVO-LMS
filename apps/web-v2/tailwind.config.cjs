const brandPreset = require("@aivo/brand/tailwind-preset");

/** @type {import('tailwindcss').Config} */
module.exports = {
  presets: [brandPreset],
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}",
    // Shared @aivo/ui primitives — Tailwind v4 must scan these so
    // arbitrary-value utilities like `bg-[var(--aivo-lavender-100)]`
    // that appear only inside the published components actually get
    // emitted into the bundle. Without this, pastel tutor tiles and
    // subject chips silently render unstyled.
    "../../packages/ui/src/**/*.{ts,tsx}",
    "../../packages/ui/dist/**/*.js",
    // Learner surfaces (SurfaceHost, ChoiceGridSurface, ScratchpadSurface,
    // …) live in their own package but are styled with the Playful Calm
    // token utilities (`rounded-iw-card`, `bg-[var(--aivo-sensory-…)]`).
    // Tailwind must scan them so those classes actually ship.
    "../../packages/learner-surfaces/src/**/*.{ts,tsx}",
    "../../packages/learner-surfaces/dist/**/*.js",
  ],
};
