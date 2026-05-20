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
  "tokens/semantic/domain.json",
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

const META_KEYS = new Set(["description", "note", "notes", "doc", "$description"]);
const flatten = (obj, prefix = []) => {
  const out = [];
  for (const [k, v] of Object.entries(obj)) {
    if (META_KEYS.has(k)) continue;
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
  // Named motion keyframes. Each named animation is duration- and easing-token-driven.
  `@keyframes aivo-ai-thinking { 0% { opacity: 0.45; transform: scale(1); } 50% { opacity: 1; transform: scale(1.06); } 100% { opacity: 0.45; transform: scale(1); } }`,
  `@keyframes aivo-lesson-reveal { 0% { opacity: 0; transform: translateY(8px); } 100% { opacity: 1; transform: translateY(0); } }`,
  `@keyframes aivo-mastery-up { 0% { transform: scale(1); } 35% { transform: scale(1.08); } 100% { transform: scale(1); } }`,
  `@keyframes aivo-approve { 0% { opacity: 0; transform: scale(0.92); } 60% { opacity: 1; transform: scale(1.04); } 100% { opacity: 1; transform: scale(1); } }`,
  `@keyframes aivo-baseline-gen { 0% { background-position: 0% 50%; } 100% { background-position: 200% 50%; } }`,
  `.aivo-motion-ai-thinking { animation: aivo-ai-thinking 1400ms linear infinite; }`,
  `.aivo-motion-lesson-reveal { animation: aivo-lesson-reveal 520ms cubic-bezier(0.16, 1, 0.3, 1) both; }`,
  `.aivo-motion-mastery-up { animation: aivo-mastery-up 720ms cubic-bezier(0.34, 1.56, 0.64, 1); }`,
  `.aivo-motion-approve { animation: aivo-approve 320ms cubic-bezier(0.22, 1, 0.36, 1) both; }`,
  `.aivo-motion-baseline-gen { animation: aivo-baseline-gen 1800ms linear infinite; background-size: 200% 100%; }`,
  // Reduced-motion: collapse durations + skip transforms, keep opacity finals.
  "@media (prefers-reduced-motion: reduce) { :root { --aivo-motion-duration-fast: 0ms; --aivo-motion-duration-base: 0ms; --aivo-motion-duration-slow: 0ms; --aivo-motion-duration-playful: 0ms; --aivo-motion-duration-aiThinking: 0ms; --aivo-motion-duration-lessonReveal: 0ms; --aivo-motion-duration-masteryUp: 0ms; --aivo-motion-duration-approve: 0ms; --aivo-motion-duration-baselineGen: 0ms; --aivo-sensory-motionScale: 0; } .aivo-motion-ai-thinking, .aivo-motion-lesson-reveal, .aivo-motion-mastery-up, .aivo-motion-approve, .aivo-motion-baseline-gen { animation: none !important; transform: none !important; } }",
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
          ring: "var(--aivo-sensory-ringFocus)",
          // Brand scales (flat, sensory-independent)
          purple: {
            50:  "var(--aivo-color-aivoPurple-50)",
            100: "var(--aivo-color-aivoPurple-100)",
            200: "var(--aivo-color-aivoPurple-200)",
            300: "var(--aivo-color-aivoPurple-300)",
            400: "var(--aivo-color-aivoPurple-400)",
            500: "var(--aivo-color-aivoPurple-500)",
            600: "var(--aivo-color-aivoPurple-600)",
            700: "var(--aivo-color-aivoPurple-700)",
            800: "var(--aivo-color-aivoPurple-800)",
            900: "var(--aivo-color-aivoPurple-900)",
            950: "var(--aivo-color-aivoPurple-950)"
          },
          teal: {
            50:  "var(--aivo-color-aivoTeal-50)",
            100: "var(--aivo-color-aivoTeal-100)",
            200: "var(--aivo-color-aivoTeal-200)",
            300: "var(--aivo-color-aivoTeal-300)",
            400: "var(--aivo-color-aivoTeal-400)",
            500: "var(--aivo-color-aivoTeal-500)",
            600: "var(--aivo-color-aivoTeal-600)",
            700: "var(--aivo-color-aivoTeal-700)",
            800: "var(--aivo-color-aivoTeal-800)",
            900: "var(--aivo-color-aivoTeal-900)",
            950: "var(--aivo-color-aivoTeal-950)"
          },
          orange: {
            50:  "var(--aivo-color-aivoOrange-50)",
            100: "var(--aivo-color-aivoOrange-100)",
            200: "var(--aivo-color-aivoOrange-200)",
            300: "var(--aivo-color-aivoOrange-300)",
            400: "var(--aivo-color-aivoOrange-400)",
            500: "var(--aivo-color-aivoOrange-500)",
            600: "var(--aivo-color-aivoOrange-600)",
            700: "var(--aivo-color-aivoOrange-700)",
            800: "var(--aivo-color-aivoOrange-800)",
            900: "var(--aivo-color-aivoOrange-900)",
            950: "var(--aivo-color-aivoOrange-950)"
          },
          // Universal status
          success: "var(--aivo-color-status-success)",
          warning: "var(--aivo-color-status-warning)",
          error:   "var(--aivo-color-status-error)",
          info:    "var(--aivo-color-status-info)",
          // Domain status (each has subtle / default / strong / on)
          mastery: {
            "emerging-subtle":   "var(--aivo-domain-mastery-emerging-subtle)",
            "emerging":          "var(--aivo-domain-mastery-emerging-default)",
            "emerging-strong":   "var(--aivo-domain-mastery-emerging-strong)",
            "developing-subtle": "var(--aivo-domain-mastery-developing-subtle)",
            "developing":        "var(--aivo-domain-mastery-developing-default)",
            "developing-strong": "var(--aivo-domain-mastery-developing-strong)",
            "proficient-subtle": "var(--aivo-domain-mastery-proficient-subtle)",
            "proficient":        "var(--aivo-domain-mastery-proficient-default)",
            "proficient-strong": "var(--aivo-domain-mastery-proficient-strong)",
            "mastered-subtle":   "var(--aivo-domain-mastery-mastered-subtle)",
            "mastered":          "var(--aivo-domain-mastery-mastered-default)",
            "mastered-strong":   "var(--aivo-domain-mastery-mastered-strong)"
          },
          risk: {
            "low-subtle":      "var(--aivo-domain-risk-low-subtle)",
            "low":             "var(--aivo-domain-risk-low-default)",
            "watch-subtle":    "var(--aivo-domain-risk-watch-subtle)",
            "watch":           "var(--aivo-domain-risk-watch-default)",
            "elevated-subtle": "var(--aivo-domain-risk-elevated-subtle)",
            "elevated":        "var(--aivo-domain-risk-elevated-default)",
            "high-subtle":     "var(--aivo-domain-risk-high-subtle)",
            "high":            "var(--aivo-domain-risk-high-default)"
          },
          consent: {
            "pending-subtle": "var(--aivo-domain-consent-pending-subtle)",
            "pending":        "var(--aivo-domain-consent-pending-default)",
            "granted-subtle": "var(--aivo-domain-consent-granted-subtle)",
            "granted":        "var(--aivo-domain-consent-granted-default)",
            "revoked-subtle": "var(--aivo-domain-consent-revoked-subtle)",
            "revoked":        "var(--aivo-domain-consent-revoked-default)",
            "expired-subtle": "var(--aivo-domain-consent-expired-subtle)",
            "expired":        "var(--aivo-domain-consent-expired-default)"
          },
          billing: {
            "paid-subtle":     "var(--aivo-domain-billing-paid-subtle)",
            "paid":            "var(--aivo-domain-billing-paid-default)",
            "due-subtle":      "var(--aivo-domain-billing-due-subtle)",
            "due":             "var(--aivo-domain-billing-due-default)",
            "overdue-subtle":  "var(--aivo-domain-billing-overdue-subtle)",
            "overdue":         "var(--aivo-domain-billing-overdue-default)",
            "trial-subtle":    "var(--aivo-domain-billing-trial-subtle)",
            "trial":           "var(--aivo-domain-billing-trial-default)",
            "refunded-subtle": "var(--aivo-domain-billing-refunded-subtle)",
            "refunded":        "var(--aivo-domain-billing-refunded-default)"
          },
          safety: {
            "safe-subtle":   "var(--aivo-domain-safety-safe-subtle)",
            "safe":          "var(--aivo-domain-safety-safe-default)",
            "review-subtle": "var(--aivo-domain-safety-review-subtle)",
            "review":        "var(--aivo-domain-safety-review-default)",
            "flag-subtle":   "var(--aivo-domain-safety-flag-subtle)",
            "flag":          "var(--aivo-domain-safety-flag-default)",
            "block-subtle":  "var(--aivo-domain-safety-block-subtle)",
            "block":         "var(--aivo-domain-safety-block-default)"
          },
          completion: {
            "notStarted-subtle": "var(--aivo-domain-completion-notStarted-subtle)",
            "notStarted":        "var(--aivo-domain-completion-notStarted-default)",
            "inProgress-subtle": "var(--aivo-domain-completion-inProgress-subtle)",
            "inProgress":        "var(--aivo-domain-completion-inProgress-default)",
            "submitted-subtle":  "var(--aivo-domain-completion-submitted-subtle)",
            "submitted":         "var(--aivo-domain-completion-submitted-default)",
            "complete-subtle":   "var(--aivo-domain-completion-complete-subtle)",
            "complete":          "var(--aivo-domain-completion-complete-default)",
            "overdue-subtle":    "var(--aivo-domain-completion-overdue-subtle)",
            "overdue":           "var(--aivo-domain-completion-overdue-default)"
          }
        }
      },
      borderRadius: {
        md: "var(--aivo-radius-md)",
        lg: "var(--aivo-radius-lg)",
        xl: "var(--aivo-radius-xl)",
        "2xl": "var(--aivo-radius-2xl)",
        pill: "var(--aivo-radius-pill)",
        "iw-card": "var(--aivo-radius-card)",
        "iw-card-lg": "var(--aivo-radius-cardLg)",
        "iw-hero": "var(--aivo-radius-hero)",
        "iw-control": "var(--aivo-radius-control)",
        "iw-chip": "var(--aivo-radius-chip)",
        "iw-sheet-top": "var(--aivo-radius-sheetTop)"
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
        "iw-display": ["var(--font-aivo-display)", "Inter Display", "Inter", "ui-sans-serif", "system-ui", "sans-serif"],
        "iw-body": ["var(--font-aivo-body)", "Inter", "ui-sans-serif", "system-ui", "sans-serif"],
        "iw-dyslexia": ["var(--font-aivo-dyslexia)", "Atkinson Hyperlegible", "OpenDyslexic", "Inter", "ui-sans-serif", "system-ui", "sans-serif"]
      },
      fontVariantNumeric: {
        "iw-tabular": "tabular-nums"
      }
    }
  },
  plugins: [
    function ({ addUtilities }) {
      addUtilities({
        ".iw-tabular": { "font-variant-numeric": "tabular-nums" },
        ".iw-metric-xl": { "font-size": "3rem", "line-height": "3.25rem", "letter-spacing": "-0.03em", "font-weight": "700", "font-variant-numeric": "tabular-nums" },
        ".iw-metric-lg": { "font-size": "2.25rem", "line-height": "2.5rem", "letter-spacing": "-0.025em", "font-weight": "700", "font-variant-numeric": "tabular-nums" },
        ".iw-metric-md": { "font-size": "1.5rem", "line-height": "1.875rem", "letter-spacing": "-0.015em", "font-weight": "600", "font-variant-numeric": "tabular-nums" },
        ".iw-metric-sm": { "font-size": "1.125rem", "line-height": "1.5rem", "letter-spacing": "-0.01em", "font-weight": "600", "font-variant-numeric": "tabular-nums" },
        ".iw-label":    { "font-size": "0.875rem", "line-height": "1.25rem", "font-weight": "500", "letter-spacing": "0.005em" },
        ".iw-label-sm": { "font-size": "0.75rem", "line-height": "1rem", "font-weight": "600", "letter-spacing": "0.04em", "text-transform": "uppercase" },
        ".iw-caption":  { "font-size": "0.75rem", "line-height": "1.125rem", "font-weight": "400", "letter-spacing": "0.01em" },
        ".iw-safe-top":    { "padding-top": "env(safe-area-inset-top)" },
        ".iw-safe-bottom": { "padding-bottom": "env(safe-area-inset-bottom)" },
        ".iw-safe-x":      { "padding-left": "env(safe-area-inset-left)", "padding-right": "env(safe-area-inset-right)" },
        ".iw-touch":       { "min-height": "44px", "min-width": "44px" }
      });
    }
  ]
};
`;

fs.writeFileSync(path.join(distDir, "css", "tokens.css"), css);
fs.writeFileSync(path.join(distDir, "ts", "tokens.ts"), ts);
fs.writeFileSync(path.join(distDir, "json", "tokens.json"), JSON.stringify(tokens, null, 2));
fs.writeFileSync(path.join(distDir, "tailwind", "preset.cjs"), preset);

console.log("Playful Calm tokens built.");
