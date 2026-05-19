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
  "tokens/modes/sensory.json",
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

const sensoryVars = tokens.modes.sensory
  ? Object.entries(tokens.modes.sensory).map(([name, values]) =>
      cssBlock(`[data-sensory-mode=\"${name}\"]`,
        flatten({ sensory: values }),
      ))
  : [];

// Emit the "standard" sensory mode defaults under :root so apps that
// don't yet set `<html data-sensory-mode="…">` still get a usable
// palette out of the box.
const sensoryRootDefaults = tokens.modes.sensory?.standard
  ? cssBlock(":root", flatten({ sensory: tokens.modes.sensory.standard }))
  : "";

fs.mkdirSync(path.join(distDir, "css"), { recursive: true });
fs.mkdirSync(path.join(distDir, "ts"), { recursive: true });
fs.mkdirSync(path.join(distDir, "json"), { recursive: true });
fs.mkdirSync(path.join(distDir, "tailwind"), { recursive: true });

const css = [
  ":root { color-scheme: light; }",
  cssBlock(":root", baseVars),
  sensoryRootDefaults,
  ...themeVars,
  ...ageVars,
  ...sensoryVars,
  "@media (prefers-reduced-motion: reduce) { :root { --aivo-motion-duration-fast: 0ms; --aivo-motion-duration-base: 0ms; --aivo-motion-duration-slow: 0ms; --aivo-motion-duration-playful: 0ms; --aivo-sensory-motionScale: 0; } }",
].filter(Boolean).join("\n\n");

const ts = `export const playfulCalmTokens = ${JSON.stringify(tokens, null, 2)} as const;\nexport type PlayfulCalmTokens = typeof playfulCalmTokens;\n`;

const preset = `module.exports = {
  theme: {
    extend: {
      colors: {
        brand: {
          primary: "var(--aivo-semantic-color-interactive-primary-default)",
          secondary: "var(--aivo-semantic-color-interactive-secondary-default)",
          meadow: "var(--aivo-color-meadow-400)",
          sunshine: "var(--aivo-color-sunshine-400)",
          lavender: "var(--aivo-color-lavender-400)",
          canvas: "var(--aivo-semantic-color-surface-canvas)",
          surface: "var(--aivo-semantic-color-surface-base)",
          ink: "var(--aivo-semantic-color-text-primary)"
        },
        // Inclusive-Warm sensory-mode-aware semantic tokens. These resolve
        // through CSS variables, so the same Tailwind class repaints itself
        // when [data-sensory-mode] flips on <html>.
        iw: {
          bg: "var(--aivo-sensory-bgPage)",
          card: "var(--aivo-sensory-bgCard)",
          raised: "var(--aivo-sensory-bgRaised)",
          primary: "var(--aivo-sensory-primary)",
          "primary-hover": "var(--aivo-sensory-primaryHover)",
          "primary-fg": "var(--aivo-sensory-primaryFg)",
          accent: "var(--aivo-sensory-accent)",
          "accent-soft": "var(--aivo-sensory-accentSoft)",
          warm: "var(--aivo-sensory-warm)",
          "warm-soft": "var(--aivo-sensory-warmSoft)",
          ink: "var(--aivo-sensory-ink)",
          "ink-muted": "var(--aivo-sensory-inkMuted)",
          border: "var(--aivo-sensory-border)",
          ring: "var(--aivo-sensory-ringFocus)"
        }
      },
      borderRadius: {
        md: "var(--aivo-radius-md)",
        lg: "var(--aivo-radius-lg)",
        xl: "var(--aivo-radius-xl)",
        "2xl": "var(--aivo-radius-2xl)",
        pill: "var(--aivo-radius-pill)",
        "iw-card": "1.75rem",
        "iw-card-lg": "2.25rem",
        "iw-hero": "2.75rem"
      },
      boxShadow: {
        "soft-1": "var(--aivo-shadow-soft-1)",
        "soft-3": "var(--aivo-shadow-soft-3)",
        "soft-5": "var(--aivo-shadow-soft-5)"
      },
      backgroundImage: {
        // Identity gradient (logo, email). Does NOT respond to sensory mode.
        "iw-brand": "linear-gradient(135deg, #7c3aed 0%, #14b8a6 100%)",
        // In-product gradient (headline word, hero accents). Responds to sensory mode.
        "iw-sensory-brand": "linear-gradient(135deg, var(--aivo-sensory-primary) 0%, var(--aivo-sensory-accent) 100%)",
        "iw-hero": "linear-gradient(180deg, var(--aivo-sensory-bgPage) 0%, var(--aivo-sensory-bgRaised) 70%)"
      },
      fontFamily: {
        "iw-display": ["Satoshi Variable", "Satoshi", "Inter", "ui-sans-serif", "system-ui", "sans-serif"],
        "iw-body": ["Inter", "ui-sans-serif", "system-ui", "sans-serif"],
        "iw-dyslexia": ["Atkinson Hyperlegible", "OpenDyslexic", "Inter", "ui-sans-serif", "system-ui", "sans-serif"]
      }
    }
  }
};
`;

fs.writeFileSync(path.join(distDir, "css", "tokens.css"), css);
fs.writeFileSync(path.join(distDir, "ts", "tokens.ts"), ts);
fs.writeFileSync(path.join(distDir, "json", "tokens.json"), JSON.stringify(tokens, null, 2));
fs.writeFileSync(path.join(distDir, "tailwind", "preset.cjs"), preset);

console.log("Playful Calm tokens built.");
