// Build a static "Storybook" gallery for the Aivo Playful Calm design system.
//
// This intentionally does not depend on Storybook 8 to keep the dependency
// surface small. It produces a real, data-driven gallery from the brand tokens
// and the mascot SVGs, so the page actually demonstrates the system in every
// theme × age-mode combination instead of just listing component names.
//
// Inputs:
//   - ../../brand/dist/css/tokens.css      (built via `pnpm --filter @aivo/brand build`)
//   - ../../brand/dist/json/tokens.json
//   - ../../brand/assets/mascots/*.svg
//
// Output:
//   - ../storybook-static/index.html
//
// The page includes:
//   * Theme switcher (light / dark / high-contrast)
//   * Age-mode switcher (sprout / spark / scholar)
//   * Live primitive demos (Button, Card, Input, Badge, ProgressBar/Ring, Switch, etc.)
//   * Pattern demos (LessonCard, MascotCoach, StickerBook, FocusMode, AudioControlBar)
//   * Token swatches (color palettes, radius, spacing, shadow, typography scale)
//   * Mascot gallery (Aivo Owl × Pip Fox × Echo Whale, 6 expressions each)

import fs from "node:fs";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { DataTable, AdminKpiCard, AdminCard } from "@aivo/admin-ui";
import { BeatPreview, ProgressPath } from "@aivo/stage-ui";
import { TIER_THEME_DATA } from "@aivo/brand";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "..");
const brand = path.resolve(root, "..", "brand");
const outDir = path.resolve(root, "storybook-static");
fs.mkdirSync(outDir, { recursive: true });

const tokensCssPath = path.join(brand, "dist", "css", "tokens.css");
const tokensJsonPath = path.join(brand, "dist", "json", "tokens.json");

if (!fs.existsSync(tokensCssPath) || !fs.existsSync(tokensJsonPath)) {
  console.error(
    "[learner-ui] @aivo/brand tokens not built. Run `pnpm --filter @aivo/brand build` first.",
  );
  process.exit(1);
}

const tokensCss = fs.readFileSync(tokensCssPath, "utf8");
const tokens = JSON.parse(fs.readFileSync(tokensJsonPath, "utf8"));

// ---------- mascots ----------
const mascotDir = path.join(brand, "assets", "mascots");
const mascots = fs.existsSync(mascotDir)
  ? fs
      .readdirSync(mascotDir)
      .filter((f) => f.endsWith(".svg"))
      .sort()
      .map((f) => ({
        name: f.replace(/\.svg$/, ""),
        svg: fs.readFileSync(path.join(mascotDir, f), "utf8"),
      }))
  : [];

// ---------- helpers ----------
const escapeHtml = (s) =>
  String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

const colorPalettes = Object.entries(tokens.color || {}).map(([name, scale]) => ({
  name,
  scale: typeof scale === "object" ? scale : { 500: String(scale) },
}));

const radiusScale = Object.entries(tokens.radius || {});
const spacingScale = Object.entries(tokens.spacing || {});
const shadowScale = Object.entries(tokens.shadow || {});
const fontFamilies = Object.entries(tokens.typography?.fontFamily || {});
const fontSizes = Object.entries(tokens.typography?.size || {});
const motionDurations = Object.entries(tokens.motion?.duration || {});
const motionEasings = Object.entries(tokens.motion?.easing || {});

const themes = Object.keys(tokens.modes?.theme || { light: {}, dark: {}, "high-contrast": {} });
const ageModes = Object.keys(tokens.modes?.age || { sprout: {}, spark: {}, scholar: {} });

// ---------- HTML sections ----------
const colorSection = colorPalettes
  .map(({ name, scale }) => {
    const swatches = Object.entries(scale)
      .map(
        ([shade, value]) => `
        <div class="sb-swatch">
          <div class="sb-swatch__chip" style="background:${escapeHtml(String(value))}"></div>
          <div class="sb-swatch__meta">
            <strong>${escapeHtml(name)}-${escapeHtml(shade)}</strong>
            <code>${escapeHtml(String(value))}</code>
          </div>
        </div>`,
      )
      .join("");
    return `<div class="sb-palette"><h3>${escapeHtml(name)}</h3><div class="sb-palette__grid">${swatches}</div></div>`;
  })
  .join("");

const radiusSection = radiusScale
  .map(
    ([k, v]) => `
    <div class="sb-token">
      <div class="sb-token__demo" style="border-radius:${escapeHtml(String(v))};width:80px;height:80px;background:var(--aivo-semantic-color-interactive-primary-default,#3b82f6)"></div>
      <div><strong>radius.${escapeHtml(k)}</strong><br/><code>${escapeHtml(String(v))}</code></div>
    </div>`,
  )
  .join("");

const spacingSection = spacingScale
  .map(
    ([k, v]) => `
    <div class="sb-token">
      <div class="sb-token__demo" style="width:${escapeHtml(String(v))};height:16px;background:var(--aivo-color-lavender-400,#a78bfa);border-radius:4px"></div>
      <div><strong>spacing.${escapeHtml(k)}</strong><br/><code>${escapeHtml(String(v))}</code></div>
    </div>`,
  )
  .join("");

const shadowSection = shadowScale
  .map(
    ([k, v]) => `
    <div class="sb-token sb-token--shadow">
      <div class="sb-token__demo" style="box-shadow:${escapeHtml(String(v))};width:120px;height:64px;background:#fff;border-radius:12px"></div>
      <div><strong>shadow.${escapeHtml(k)}</strong></div>
    </div>`,
  )
  .join("");

const typeSection = `
  <div class="sb-type">
    ${fontFamilies
      .map(
        ([k, v]) => `<p style="font-family:${escapeHtml(String(v))};font-size:1.25rem">
          <strong>${escapeHtml(k)}</strong>: The quick brown fox jumps over the lazy dog 1234567890
        </p>`,
      )
      .join("")}
    ${fontSizes
      .map(([k, v]) => {
        const fs = v?.fontSize ?? v;
        const lh = v?.lineHeight ?? "1.4";
        return `<p style="font-size:${escapeHtml(String(fs))};line-height:${escapeHtml(String(lh))};margin:4px 0"><code>${escapeHtml(k)}</code> — Learning is the seed of curiosity.</p>`;
      })
      .join("")}
  </div>
`;

const motionSection = `
  <div class="sb-grid">
    ${motionDurations
      .map(
        ([k, v]) =>
          `<div class="sb-card"><strong>duration.${escapeHtml(k)}</strong><br/><code>${escapeHtml(String(v))}</code></div>`,
      )
      .join("")}
    ${motionEasings
      .map(
        ([k, v]) =>
          `<div class="sb-card"><strong>easing.${escapeHtml(k)}</strong><br/><code>${escapeHtml(String(v))}</code></div>`,
      )
      .join("")}
  </div>
`;

const mascotSection = mascots.length
  ? `<div class="sb-mascots">${mascots
      .map(
        (m) =>
          `<figure class="sb-mascot"><div class="sb-mascot__art">${m.svg}</div><figcaption>${escapeHtml(m.name)}</figcaption></figure>`,
      )
      .join("")}</div>`
  : `<p><em>Mascot SVGs not found at <code>packages/brand/assets/mascots/</code>.</em></p>`;

// ---------- Live primitive demos (rendered as static HTML with the same
// tokenized styles the React primitives use) ----------
const buttonRow = `
  <div class="sb-row">
    <button class="pc-btn pc-btn--primary">Primary</button>
    <button class="pc-btn pc-btn--secondary">Secondary</button>
    <button class="pc-btn pc-btn--ghost">Ghost</button>
    <button class="pc-btn pc-btn--playful">Playful</button>
    <button class="pc-btn pc-btn--audio" aria-label="Read aloud">🔊 Read aloud</button>
  </div>
  <div class="sb-row">
    <button class="pc-btn pc-btn--primary pc-btn--sm">Small</button>
    <button class="pc-btn pc-btn--primary">Medium</button>
    <button class="pc-btn pc-btn--primary pc-btn--lg">Large</button>
    <button class="pc-btn pc-btn--primary pc-btn--xl">Extra large</button>
    <button class="pc-btn pc-btn--primary pc-btn--hero">Hero</button>
  </div>
`;

const formRow = `
  <label class="pc-field"><span>Email</span><input class="pc-input" type="email" placeholder="learner@aivo.app" /></label>
  <label class="pc-field"><span>Grade</span>
    <select class="pc-input"><option>K</option><option>1</option><option>2</option><option>3</option></select>
  </label>
  <label class="pc-checkbox"><input type="checkbox" checked /> Read aloud by default</label>
  <label class="pc-checkbox"><input type="radio" name="theme" checked /> Calm Sky</label>
  <label class="pc-checkbox"><input type="radio" name="theme" /> Meadow</label>
  <button class="pc-switch" role="switch" aria-checked="true" aria-label="Sound on"><span></span></button>
`;

const badgeRow = `
  <span class="pc-badge">+25 XP</span>
  <span class="pc-badge pc-badge--coral">🔥 5 day streak</span>
  <span class="pc-badge pc-badge--meadow">Completed</span>
  <span class="pc-badge pc-badge--sunshine">New</span>
`;

const progressRow = `
  <div style="width:280px"><div class="pc-progress"><div class="pc-progress__bar" style="width:64%"></div></div></div>
  <svg width="88" height="88" viewBox="0 0 88 88" aria-label="Progress ring 70%">
    <circle cx="44" cy="44" r="36" stroke="var(--aivo-semantic-color-border-subtle,#e5e7eb)" stroke-width="8" fill="none" />
    <circle cx="44" cy="44" r="36" stroke="var(--aivo-semantic-color-interactive-primary-default,#3b82f6)" stroke-width="8" fill="none" stroke-dasharray="226" stroke-dashoffset="68" transform="rotate(-90 44 44)" />
  </svg>
`;

const patternsHtml = `
  <div class="sb-grid">
    <div class="pc-card" style="padding:20px">
      <p style="margin:0;font-weight:700">Lesson 3 — Counting clouds</p>
      <p style="margin:4px 0">8 min</p>
      <span class="pc-badge">+25 XP</span>
      <div style="margin-top:12px"><button class="pc-btn pc-btn--primary">Start</button></div>
    </div>
    <div class="pc-card" style="padding:16px">
      <strong>Mascot Coach</strong>
      <p>You're doing great — ready for the next one?</p>
      <button class="pc-btn pc-btn--audio">🔊 Read aloud</button>
    </div>
    <div class="pc-card" style="padding:16px">
      <strong>Sticker Book</strong>
      <div style="display:grid;gap:8px;grid-template-columns:repeat(3,1fr);margin-top:8px">
        <div class="pc-sticker">⭐</div>
        <div class="pc-sticker">🦊</div>
        <div class="pc-sticker pc-sticker--locked">🔒</div>
        <div class="pc-sticker">🌟</div>
        <div class="pc-sticker pc-sticker--locked">🔒</div>
        <div class="pc-sticker">🎉</div>
      </div>
    </div>
    <div class="pc-card" style="padding:20px">
      <div style="display:flex;justify-content:space-between;align-items:center">
        <h3 style="margin:0">Focus Mode</h3>
        <svg width="56" height="56" viewBox="0 0 88 88"><circle cx="44" cy="44" r="36" stroke="#e5e7eb" stroke-width="8" fill="none"/><circle cx="44" cy="44" r="36" stroke="var(--aivo-color-meadow-500,#10b981)" stroke-width="8" fill="none" stroke-dasharray="226" stroke-dashoffset="113" transform="rotate(-90 44 44)"/></svg>
      </div>
      <p>Distraction-free reading on.</p>
    </div>
    <div class="pc-card" style="padding:16px;display:flex;gap:12px;align-items:center">
      <span>🔊 60%</span><span>⏱ 1×</span>
      <button class="pc-btn pc-btn--audio">Voice</button>
    </div>
    <div class="pc-card" style="padding:16px">
      <strong>Learning Path</strong>
      <ol style="margin:8px 0;padding-left:20px">
        <li><span class="pc-badge pc-badge--meadow">complete</span> Letters</li>
        <li><span class="pc-badge">current</span> Numbers</li>
        <li><span class="pc-badge pc-badge--cloud">locked</span> Shapes</li>
      </ol>
    </div>
  </div>
`;

// ---------- assemble page ----------
const css = `
${tokensCss}

* { box-sizing: border-box; }
html, body { margin: 0; padding: 0; }
body {
  font-family: var(--aivo-fontFamily-body, 'Nunito', system-ui, sans-serif);
  background: var(--aivo-semantic-color-surface-base, #f9fafb);
  color: var(--aivo-semantic-color-text-primary, #111827);
  padding: 24px;
}
h1, h2, h3 { font-family: var(--aivo-fontFamily-display, 'Fredoka', system-ui, sans-serif); }
h1 { font-size: 2rem; margin: 0 0 8px; }
h2 { margin-top: 32px; }
code { background: rgba(0,0,0,.05); padding: 2px 6px; border-radius: 6px; font-size: 12px; }

.sb-toolbar {
  position: sticky; top: 0; z-index: 10;
  display: flex; flex-wrap: wrap; gap: 12px; align-items: center;
  background: var(--aivo-semantic-color-surface-raised, #fff);
  border: 1px solid var(--aivo-semantic-color-border-subtle, #e5e7eb);
  border-radius: 16px;
  padding: 12px 16px;
  margin-bottom: 24px;
  box-shadow: var(--aivo-shadow-soft-1, 0 2px 6px rgba(0,0,0,.06));
}
.sb-toolbar fieldset { border: 0; padding: 0; margin: 0; display: flex; gap: 6px; align-items: center; }
.sb-toolbar legend { font-weight: 700; margin-right: 4px; }
.sb-toolbar button[aria-pressed="true"] { background: var(--aivo-color-calmSky-500,#3b82f6); color: #fff; border-color: transparent; }

.sb-section {
  background: var(--aivo-semantic-color-surface-raised, #fff);
  border: 1px solid var(--aivo-semantic-color-border-subtle, #e5e7eb);
  border-radius: 24px;
  padding: 20px 24px;
  margin-bottom: 24px;
}

.sb-grid { display: grid; gap: 16px; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); }
.sb-row { display: flex; flex-wrap: wrap; gap: 12px; align-items: center; margin-bottom: 12px; }
.sb-card {
  padding: 12px;
  border-radius: 16px;
  background: var(--aivo-semantic-color-surface-base, #f9fafb);
  border: 1px solid var(--aivo-semantic-color-border-subtle, #e5e7eb);
}

.sb-palette { margin-bottom: 16px; }
.sb-palette__grid { display: grid; gap: 8px; grid-template-columns: repeat(auto-fill, minmax(140px, 1fr)); }
.sb-swatch { display: flex; gap: 8px; align-items: center; padding: 6px; border-radius: 12px; background: var(--aivo-semantic-color-surface-base,#f9fafb); border: 1px solid var(--aivo-semantic-color-border-subtle,#e5e7eb); }
.sb-swatch__chip { width: 40px; height: 40px; border-radius: 12px; border: 1px solid rgba(0,0,0,.08); flex: 0 0 40px; }
.sb-swatch__meta { font-size: 12px; line-height: 1.3; }

.sb-token { display: flex; gap: 12px; align-items: center; padding: 8px; border-radius: 12px; background: var(--aivo-semantic-color-surface-base,#f9fafb); }
.sb-token__demo { flex: 0 0 auto; }

.sb-mascots { display: grid; gap: 16px; grid-template-columns: repeat(auto-fill, minmax(140px, 1fr)); }
.sb-mascot { margin: 0; text-align: center; padding: 8px; border-radius: 16px; background: var(--aivo-semantic-color-surface-base,#f9fafb); border: 1px solid var(--aivo-semantic-color-border-subtle,#e5e7eb); }
.sb-mascot__art svg { width: 100%; height: auto; max-height: 120px; }
.sb-mascot figcaption { font-size: 12px; margin-top: 4px; }

/* Playful Calm primitive styles — token-driven */
.pc-btn {
  font: inherit; font-weight: 700;
  min-height: 56px;
  padding: 0 20px;
  border-radius: var(--aivo-radius-xl, 24px);
  background: var(--aivo-semantic-color-interactive-primary-default, #3b82f6);
  color: var(--aivo-semantic-color-text-onPrimary, #fff);
  border: 0;
  cursor: pointer;
  transition: transform var(--aivo-motion-duration-fast, 150ms) var(--aivo-motion-easing-spring-bounce, cubic-bezier(.34,1.56,.64,1));
}
.pc-btn:hover { transform: translateY(-1px); }
.pc-btn:focus-visible { outline: 3px solid var(--aivo-color-sunshine-400, #fbbf24); outline-offset: 2px; }
.pc-btn--secondary { background: var(--aivo-semantic-color-interactive-secondary-default, #f43f5e); }
.pc-btn--ghost     { background: transparent; color: var(--aivo-semantic-color-text-primary,#111827); border: 2px solid var(--aivo-semantic-color-border-default,#d1d5db); }
.pc-btn--playful   { background: var(--aivo-color-lavender-500, #8b5cf6); }
.pc-btn--audio     { background: var(--aivo-semantic-color-interactive-audio-default, #34d399); }
.pc-btn--sm   { min-height: 48px; padding: 0 14px; }
.pc-btn--lg   { min-height: 60px; padding: 0 22px; font-size: 1.1rem; }
.pc-btn--xl   { min-height: 64px; padding: 0 26px; font-size: 1.15rem; }
.pc-btn--hero { min-height: 72px; padding: 0 32px; font-size: 1.25rem; }

.pc-card {
  border-radius: var(--aivo-radius-xl, 24px);
  background: var(--aivo-semantic-color-surface-raised, #fff);
  box-shadow: var(--aivo-shadow-soft-2, 0 6px 12px rgba(59,130,246,.1));
  border: 1px solid var(--aivo-semantic-color-border-subtle, #e5e7eb);
}

.pc-field { display: flex; flex-direction: column; gap: 4px; min-width: 180px; }
.pc-field span { font-weight: 600; font-size: 14px; }
.pc-input {
  min-height: 56px;
  border-radius: var(--aivo-radius-lg, 16px);
  border: 2px solid var(--aivo-semantic-color-border-default, #d1d5db);
  padding: 0 16px;
  background: var(--aivo-semantic-color-surface-raised, #fff);
  color: var(--aivo-semantic-color-text-primary, #111827);
  font: inherit;
}
.pc-input:focus-visible { outline: 3px solid var(--aivo-color-sunshine-400,#fbbf24); outline-offset: 2px; border-color: var(--aivo-color-calmSky-500,#3b82f6); }
.pc-checkbox { display: inline-flex; gap: 8px; align-items: center; padding: 8px 12px; border-radius: 12px; background: var(--aivo-semantic-color-surface-base,#f9fafb); }
.pc-checkbox input { width: 20px; height: 20px; accent-color: var(--aivo-color-calmSky-500,#3b82f6); }

.pc-switch { width: 64px; height: 36px; border-radius: 999px; border: 0; padding: 4px; background: var(--aivo-color-calmSky-500,#3b82f6); cursor: pointer; }
.pc-switch span { display: block; width: 28px; height: 28px; border-radius: 999px; background: #fff; transform: translateX(28px); transition: transform .2s ease; }
.pc-switch[aria-checked="false"] { background: var(--aivo-semantic-color-border-default,#d1d5db); }
.pc-switch[aria-checked="false"] span { transform: translateX(0); }

.pc-badge {
  display: inline-flex; align-items: center;
  border-radius: var(--aivo-radius-pill, 9999px);
  padding: 6px 12px;
  background: var(--aivo-semantic-color-interactive-primary-default, #3b82f6);
  color: var(--aivo-semantic-color-text-onPrimary, #fff);
  font-size: 12px; font-weight: 700;
}
.pc-badge--coral    { background: var(--aivo-color-sunriseCoral-500, #f43f5e); }
.pc-badge--meadow   { background: var(--aivo-color-meadow-500, #10b981); }
.pc-badge--sunshine { background: var(--aivo-color-sunshine-500, #f59e0b); color:#1f2937; }
.pc-badge--cloud    { background: var(--aivo-color-cloud-300, #d1d5db); color: var(--aivo-color-cloud-800,#1f2937); }

.pc-progress {
  width: 100%; height: 12px; border-radius: 9999px;
  background: var(--aivo-semantic-color-border-subtle, #e5e7eb);
  overflow: hidden;
}
.pc-progress__bar {
  height: 100%; border-radius: 9999px;
  background: linear-gradient(90deg, var(--aivo-color-calmSky-500,#3b82f6), var(--aivo-color-lavender-500,#8b5cf6));
}

.pc-sticker { display: grid; place-items: center; aspect-ratio: 1; border-radius: 16px; background: var(--aivo-color-sunshine-100,#fef3c7); font-size: 28px; }
.pc-sticker--locked { background: var(--aivo-color-cloud-200,#e5e7eb); color: var(--aivo-color-cloud-500,#6b7280); }

/* Dark mode polish — handled by tokens.css [data-theme="dark"], with a couple of UI tweaks */
[data-theme="dark"] body { background: var(--aivo-semantic-color-surface-base, #0f172a); color: var(--aivo-semantic-color-text-primary, #f8fafc); }
[data-theme="high-contrast"] body { background: #000; color: #fff; }
[data-theme="high-contrast"] .pc-btn { outline: 2px solid #fff; }

/* Age-mode rounding adjustments (visual nod — full token tuning lives in @aivo/brand) */
[data-age-mode="sprout"]  .pc-btn, [data-age-mode="sprout"]  .pc-card { border-radius: 28px; }
[data-age-mode="spark"]   .pc-btn, [data-age-mode="spark"]   .pc-card { border-radius: 20px; }
[data-age-mode="scholar"] .pc-btn, [data-age-mode="scholar"] .pc-card { border-radius: 12px; }
`;

const toolbar = `
  <div class="sb-toolbar" role="toolbar" aria-label="Storybook controls">
    <fieldset>
      <legend>Theme</legend>
      ${themes
        .map(
          (t, i) =>
            `<button class="pc-btn pc-btn--ghost pc-btn--sm" aria-pressed="${i === 0}" data-action="theme" data-value="${escapeHtml(t)}">${escapeHtml(t)}</button>`,
        )
        .join("")}
    </fieldset>
    <fieldset>
      <legend>Age mode</legend>
      ${ageModes
        .map(
          (m, i) =>
            `<button class="pc-btn pc-btn--ghost pc-btn--sm" aria-pressed="${i === 1}" data-action="ageMode" data-value="${escapeHtml(m)}">${escapeHtml(m)}</button>`,
        )
        .join("")}
    </fieldset>
    <fieldset>
      <legend>Dyslexia font</legend>
      <button class="pc-btn pc-btn--ghost pc-btn--sm" aria-pressed="false" data-action="dyslexia">Toggle</button>
    </fieldset>
  </div>
`;

const script = `
<script>
(function () {
  function setAttr(name, value, btn) {
    document.documentElement.setAttribute(name, value);
    var group = btn.closest('fieldset');
    if (!group) return;
    group.querySelectorAll('[aria-pressed]').forEach(function (b) {
      b.setAttribute('aria-pressed', b === btn ? 'true' : 'false');
    });
  }
  document.documentElement.setAttribute('data-theme', '${themes[0] || "light"}');
  document.documentElement.setAttribute('data-age-mode', '${ageModes[1] || ageModes[0] || "spark"}');
  document.addEventListener('click', function (e) {
    var btn = e.target.closest('[data-action]');
    if (!btn) return;
    var action = btn.getAttribute('data-action');
    if (action === 'theme')   setAttr('data-theme',    btn.getAttribute('data-value'), btn);
    if (action === 'ageMode') setAttr('data-age-mode', btn.getAttribute('data-value'), btn);
    if (action === 'dyslexia') {
      var on = btn.getAttribute('aria-pressed') !== 'true';
      btn.setAttribute('aria-pressed', String(on));
      document.body.style.fontFamily = on
        ? "var(--aivo-fontFamily-dyslexia, 'OpenDyslexic', 'Comic Sans MS', sans-serif)"
        : '';
    }
  });
})();
</script>
`;

let html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <title>Aivo Playful Calm — Storybook</title>
  <style>${css}</style>
</head>
<body>
  <header>
    <h1>Aivo Playful Calm — Storybook</h1>
    <p>Live, token-driven gallery of the Playful Calm design system. Use the controls to switch theme, age mode, and dyslexia font.</p>
  </header>
  <main>
  ${toolbar}

  <section class="sb-section" id="primitives">
    <h2>Primitives</h2>
    <h3>Button</h3>
    ${buttonRow}
    <h3>Form controls</h3>
    <div class="sb-row">${formRow}</div>
    <h3>Badge</h3>
    <div class="sb-row">${badgeRow}</div>
    <h3>Progress</h3>
    <div class="sb-row">${progressRow}</div>
  </section>

  <section class="sb-section" id="patterns">
    <h2>Patterns</h2>
    ${patternsHtml}
  </section>

  <section class="sb-section" id="mascots">
    <h2>Mascots — Aivo Owl · Pip Fox · Echo Whale</h2>
    ${mascotSection}
  </section>

  <section class="sb-section" id="color">
    <h2>Color palettes</h2>
    ${colorSection}
  </section>

  <section class="sb-section" id="typography">
    <h2>Typography</h2>
    ${typeSection}
  </section>

  <section class="sb-section" id="radius">
    <h2>Radius</h2>
    <div class="sb-grid">${radiusSection}</div>
  </section>

  <section class="sb-section" id="spacing">
    <h2>Spacing</h2>
    <div class="sb-grid">${spacingSection}</div>
  </section>

  <section class="sb-section" id="shadow">
    <h2>Shadow</h2>
    <div class="sb-grid">${shadowSection}</div>
  </section>

  <section class="sb-section" id="motion">
    <h2>Motion</h2>
    ${motionSection}
  </section>

  </main>
  ${script}
</body>
</html>`;


// ── Sprint B7 — real shared components, rendered server-side ────────────
// These are the ACTUAL exports (admin-ui DataTable from Sprint B3, stage-ui
// beats) rendered with realistic fixtures via react-dom/server — not
// hand-written lookalike markup.
const h = React.createElement;

const auditRows = [
  { id: "1", when: "2026-06-11 09:14", action: "admin.learner.viewed", actor: "j.rivera@lincoln.k12", resource: "learner/8f3a…" },
  { id: "2", when: "2026-06-11 09:02", action: "SCIM_USER_CREATED", actor: "scim-provisioner", resource: "user/77b1…" },
  { id: "3", when: "2026-06-10 16:48", action: "feature_flag.override_changed", actor: "support@aivo", resource: "feature_flag/calmMode" },
];
const dataTableDemo = renderToStaticMarkup(
  h(DataTable, {
    columns: [
      { key: "when", header: "When", render: (r) => r.when, sortKey: "createdAt" },
      { key: "action", header: "Action", render: (r) => r.action },
      { key: "actor", header: "Actor", render: (r) => r.actor },
      { key: "resource", header: "Resource", render: (r) => r.resource },
    ],
    rows: auditRows,
    rowKey: (r) => r.id,
    total: 128,
    page: 2,
    pageSize: 3,
    basePath: "#",
    search: "viewed",
    sort: "createdAt:desc",
    exportHref: "#export",
    emptyMessage: "No audit entries match.",
    searchPlaceholder: "Search action, actor email, or details…",
  }),
);
const kpiDemo = renderToStaticMarkup(
  h("div", { style: { display: "flex", gap: "12px", flexWrap: "wrap" } },
    h(AdminKpiCard, { label: "Active learners", value: 1284 }),
    h(AdminKpiCard, { label: "Schools", value: 17 }),
    h(AdminKpiCard, { label: "Seats used", value: "82%" }),
  ),
);
const adminCardDemo = renderToStaticMarkup(
  h(AdminCard, { className: "p-6" },
    h("h3", null, "Hash chain intact"),
    h("p", null, "2,431 entries re-hashed — every stored fingerprint matches."),
  ),
);

let stageDemo = "";
try {
  stageDemo = renderToStaticMarkup(
    h("div", { style: { display: "grid", gap: "16px", background: "#1F1535", padding: "20px", borderRadius: "16px" } },
      h(BeatPreview, {
        beat: {
          id: "beat-1",
          type: "interaction",
          tutorState: "asking",
          interaction: {
            type: "choice",
            prompt: "Which shape has three sides?",
            choices: [
              { id: "a", label: "Triangle", isCorrect: true },
              { id: "b", label: "Square", isCorrect: false },
              { id: "c", label: "Circle", isCorrect: false },
            ],
            correctAnswer: "a",
          },
        },
        index: 1,
        isCurrent: true,
      }),
      h(ProgressPath, { current: 2, total: 5, xpEarned: 40, reducedMotion: true }),
    ),
  );
} catch (err) {
  // Stage beats need props matching the live Beat contract — fail the
  // BUILD rather than ship an empty section if the contract moves.
  throw new Error(`stage-ui demo failed to render: ${err && err.message}`);
}

const tierSection = Object.values(TIER_THEME_DATA)
  .map(
    (tier) => `
  <div class="sb-token" style="background:${escapeHtml(tier.colors.bg)};border:1px solid ${escapeHtml(tier.colors.surfaceAlt)};border-radius:16px;padding:16px;min-width:260px">
    <strong style="color:${escapeHtml(tier.colors.text)}">${escapeHtml(tier.name)}</strong>
    <span style="display:block;color:${escapeHtml(tier.colors.textSoft)};font-size:12px;margin:4px 0 10px">${escapeHtml(tier.tagline)}</span>
    <div style="display:flex;gap:6px">${["primary", "accent", "sky", "warm"]
      .map((k) => `<span title="${k}: ${escapeHtml(tier.colors[k])}" style="width:28px;height:28px;border-radius:8px;background:${escapeHtml(tier.colors[k])};display:inline-block;border:1px solid rgba(0,0,0,.08)"></span>`)
      .join("")}</div>
  </div>`,
  )
  .join("");

const axeSource = fs.readFileSync(
  path.join(root, "node_modules", "axe-core", "axe.min.js"),
  "utf8",
);
const a11ySection = `
  <section class="sb-section" id="a11y">
    <h2>Accessibility panel</h2>
    <p>axe-core <span id="sb-axe-version"></span> runs against this page on load and reports the system's CURRENT findings — the same panel reviewers use to see exactly which primitives still owe contrast work.</p>
    <div id="sb-axe-results" role="status" aria-live="polite">Running axe…</div>
  </section>
  <script>${axeSource}</script>
  <script>
    (function () {
      document.getElementById("sb-axe-version").textContent = window.axe ? window.axe.version : "?";
      window.axe.run(document, { resultTypes: ["violations"] }).then(function (results) {
        var el = document.getElementById("sb-axe-results");
        if (!results.violations.length) {
          el.textContent = "No axe violations detected on this page.";
          el.style.color = "#0f766e";
          return;
        }
        el.innerHTML = "<strong>" + results.violations.length + " violation type(s):</strong><ul>" +
          results.violations.map(function (v) {
            return "<li><code>" + v.id + "</code> (" + v.impact + ", " + v.nodes.length + " node(s)) — " + v.help + "</li>";
          }).join("") + "</ul>";
        el.style.color = "#b91c1c";
      });
    })();
  </script>`;

const sharedComponentsHtml = `
  <section class="sb-section" id="shared-components">
    <h2>Shared console components (rendered from the real exports)</h2>
    <h3>@aivo/admin-ui — DataTable (Sprint B3: server-driven search · sort · pager · audited export)</h3>
    ${dataTableDemo}
    <h3>@aivo/admin-ui — KPI cards</h3>
    ${kpiDemo}
    <h3>@aivo/admin-ui — Card</h3>
    ${adminCardDemo}
    <h3>@aivo/stage-ui — lesson beats</h3>
    ${stageDemo}
  </section>

  <section class="sb-section" id="tier-themes">
    <h2>Age-tier themes (single token source: packages/brand/tokens/modes/tier-themes.json)</h2>
    <div class="sb-row">${tierSection}</div>
  </section>
`;

html = html
  .replace("<section class=\"sb-section\" id=\"color\">", sharedComponentsHtml + "\n  <section class=\"sb-section\" id=\"color\">")
  .replace("  </main>", a11ySection + "\n  </main>");

fs.writeFileSync(path.join(outDir, "index.html"), html);
console.log("[learner-ui] storybook-static generated at", outDir);
console.log(
  `[learner-ui]   ${colorPalettes.length} palettes · ${mascots.length} mascots · ${themes.length} themes × ${ageModes.length} age modes`,
);
