import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const distDir = path.join(root, "dist");
const sourceFiles = [
  "tokens/core/color.json",
  "tokens/core/typography.json",
  "tokens/core/radius.json",
  "tokens/core/spacing.json",
  "tokens/core/shadow.json",
  "tokens/core/motion.json",
  "tokens/core/z-index.json",
  "tokens/core/breakpoint.json",
  "tokens/semantic/color.json",
  "tokens/modes/age-modes.json",
  "tokens/modes/themes.json",
];

const mergeDeep = (target, source) => {
  for (const [key, value] of Object.entries(source)) {
    if (value && typeof value === "object" && !Array.isArray(value)) {
      target[key] = mergeDeep(target[key] ?? {}, value);
    } else {
      target[key] = value;
    }
  }
  return target;
};

const tokens = sourceFiles.reduce((acc, file) => {
  const json = JSON.parse(fs.readFileSync(path.join(root, file), "utf8"));
  return mergeDeep(acc, json);
}, {});

const flatten = (obj, prefix = []) => {
  const out = [];
  for (const [k, v] of Object.entries(obj)) {
    if (v && typeof v === "object" && !Array.isArray(v)) {
      out.push(...flatten(v, [...prefix, k]));
    } else {
      out.push({ key: [...prefix, k].join("-"), value: String(v) });
    }
  }
  return out;
};

const cssBlock = (selector, vars) => {
  const lines = vars.map(({ key, value }) => `  --aivo-${key}: ${value};`);
  return `${selector} {\n${lines.join("\n")}\n}`;
};

const baseVars = flatten({
  ...tokens.color,
  ...tokens.typography,
  ...tokens.radius,
  ...tokens.spacing,
  ...tokens.shadow,
  ...tokens.motion,
  ...tokens.zIndex,
  ...tokens.breakpoint,
  ...tokens.semantic,
});

const themeVars = Object.entries(tokens.modes.theme).map(([name, values]) =>
  cssBlock(`[data-theme=\"${name}\"]`,
    flatten({ theme: values }),
  ));

const ageVars = Object.entries(tokens.modes.age).map(([name, values]) =>
  cssBlock(`[data-age-mode=\"${name}\"]`,
    flatten({ age: values }),
  ));

fs.mkdirSync(path.join(distDir, "css"), { recursive: true });
fs.mkdirSync(path.join(distDir, "ts"), { recursive: true });
fs.mkdirSync(path.join(distDir, "json"), { recursive: true });
fs.mkdirSync(path.join(distDir, "tailwind"), { recursive: true });

const css = [
  ":root { color-scheme: light; }",
  cssBlock(":root", baseVars),
  ...themeVars,
  ...ageVars,
  "@media (prefers-reduced-motion: reduce) { :root { --aivo-motion-duration-fast: 0ms; --aivo-motion-duration-base: 0ms; --aivo-motion-duration-slow: 0ms; --aivo-motion-duration-playful: 0ms; } }",
].join("\n\n");

const ts = `export const playfulCalmTokens = ${JSON.stringify(tokens, null, 2)} as const;\nexport type PlayfulCalmTokens = typeof playfulCalmTokens;\n`;

const preset = `module.exports = {\n  theme: {\n    extend: {\n      colors: {\n        brand: {\n          primary: \"var(--aivo-semantic-color-interactive-primary-default)\",\n          secondary: \"var(--aivo-semantic-color-interactive-secondary-default)\",\n          meadow: \"var(--aivo-color-meadow-400)\",\n          sunshine: \"var(--aivo-color-sunshine-400)\",\n          lavender: \"var(--aivo-color-lavender-400)\",\n          canvas: \"var(--aivo-semantic-color-surface-canvas)\",\n          surface: \"var(--aivo-semantic-color-surface-base)\",\n          ink: \"var(--aivo-semantic-color-text-primary)\"\n        }\n      },\n      borderRadius: {\n        md: \"var(--aivo-radius-md)\",\n        lg: \"var(--aivo-radius-lg)\",\n        xl: \"var(--aivo-radius-xl)\",\n        \"2xl\": \"var(--aivo-radius-2xl)\",\n        pill: \"var(--aivo-radius-pill)\"\n      },\n      boxShadow: {\n        \"soft-1\": \"var(--aivo-shadow-soft-1)\",\n        \"soft-3\": \"var(--aivo-shadow-soft-3)\",\n        \"soft-5\": \"var(--aivo-shadow-soft-5)\"\n      }\n    }\n  }\n};\n`;

fs.writeFileSync(path.join(distDir, "css", "tokens.css"), css);
fs.writeFileSync(path.join(distDir, "ts", "tokens.ts"), ts);
fs.writeFileSync(path.join(distDir, "json", "tokens.json"), JSON.stringify(tokens, null, 2));
fs.writeFileSync(path.join(distDir, "tailwind", "preset.cjs"), preset);

console.log("Playful Calm tokens built.");
