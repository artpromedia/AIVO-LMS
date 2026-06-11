#!/usr/bin/env node
/**
 * mobile-a11y-label-ratchet — Sprint A4 regression guard.
 *
 * eslint-plugin-react-native-a11y (error level in apps/mobile) is the
 * primary gate for accessibility props. This ratchet independently counts
 * ICON-ONLY pressables (no Text child) lacking an accessibilityLabel —
 * the exact class of control a screen-reader user cannot identify — and
 * fails on ANY occurrence. Baseline: 0 (Sprint A4 labeled all six).
 *
 * The scanner is brace-aware (a naive [^>]* regex false-positives on
 * `onPress={() => ...}` arrows).
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const mobileRoot = join(repoRoot, "apps/mobile");

function* walk(dir) {
  for (const name of readdirSync(dir)) {
    if (["node_modules", "dist", ".expo", "android", "ios"].includes(name)) continue;
    const abs = join(dir, name);
    if (statSync(abs).isDirectory()) yield* walk(abs);
    else if (name.endsWith(".tsx") && !name.endsWith(".test.tsx")) yield abs;
  }
}

/** attrs of the JSX opening tag starting at `start`; brace-depth aware. */
function tagAttrs(source, start) {
  let depth = 0;
  for (let i = start; i < source.length; i += 1) {
    const c = source[i];
    if (c === "{") depth += 1;
    else if (c === "}") depth -= 1;
    else if (c === ">" && depth === 0 && source[i - 1] !== "=") {
      return { attrs: source.slice(start, i), end: i };
    }
  }
  return { attrs: source.slice(start, start + 200), end: start + 200 };
}

const offenders = [];
for (const scanDir of ["app", "components", "src"].map((d) => join(mobileRoot, d))) {
  let entries;
  try {
    entries = [...walk(scanDir)];
  } catch {
    continue;
  }
  for (const file of entries) {
    const source = readFileSync(file, "utf8");
    const tagRe = /<(Pressable|TouchableOpacity|TouchableHighlight)\b/g;
    let match;
    while ((match = tagRe.exec(source))) {
      const { attrs, end } = tagAttrs(source, match.index);
      if (attrs.includes("accessibilityLabel")) continue;
      if (attrs.trimEnd().endsWith("/")) {
        // self-closing without label and without text content
        offenders.push(`${file.slice(repoRoot.length + 1)}:${line(source, match.index)}`);
        continue;
      }
      const close = source.indexOf(`</${match[1]}`, end);
      const body = source.slice(end, close === -1 ? end + 400 : close);
      if (!body.includes("<Text")) {
        offenders.push(`${file.slice(repoRoot.length + 1)}:${line(source, match.index)}`);
      }
    }
  }
}

function line(source, index) {
  return source.slice(0, index).split("\n").length;
}

if (offenders.length > 0) {
  console.error(
    `mobile-a11y-label-ratchet FAILED — ${offenders.length} icon-only ` +
      "pressable(s) without accessibilityLabel (baseline is 0):",
  );
  for (const offender of offenders) console.error(`  - ${offender}`);
  process.exit(1);
}
console.log(
  "mobile-a11y-label-ratchet OK — every icon-only pressable in apps/mobile carries an accessibilityLabel.",
);
