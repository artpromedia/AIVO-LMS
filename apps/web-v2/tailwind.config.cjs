const brandPreset = require('@aivo/brand/tailwind-preset');

/** @type {import('tailwindcss').Config} */
module.exports = {
  presets: [brandPreset],
  content: [
    './app/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
    './lib/**/*.{ts,tsx}'
  ]
};
