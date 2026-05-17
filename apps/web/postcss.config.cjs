module.exports = {
  plugins: {
    "@tailwindcss/postcss": {},
    "@csstools/postcss-oklab-function": { preserve: true, subFeatures: { displayP3: false } },
    "@csstools/postcss-color-mix-function": { preserve: true },
  },
};
