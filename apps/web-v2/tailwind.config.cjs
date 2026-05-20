const brandPreset = require('@aivo/brand/tailwind-preset');

/** @type {import('tailwindcss').Config} */
module.exports = {
  presets: [brandPreset],
  content: [
    './app/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
    './lib/**/*.{ts,tsx}',
    // Shared @aivo/ui primitives — Tailwind v4 must scan these so
    // arbitrary-value utilities like `bg-[var(--aivo-lavender-100)]`
    // that appear only inside the published components actually get
    // emitted into the bundle. Without this, pastel tutor tiles and
    // subject chips silently render unstyled.
    '../../packages/ui/src/**/*.{ts,tsx}',
    '../../packages/ui/dist/**/*.js'
  ]
};
