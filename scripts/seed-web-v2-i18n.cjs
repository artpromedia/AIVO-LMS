// Generate apps/web-v2/lib/i18n/messages/<locale>.json for all 10 locales.
// Run with: node scripts/seed-web-v2-i18n.cjs
const fs = require("node:fs");
const path = require("node:path");

const BASE = require("./web-v2-i18n-base.json");
const OUT_DIR = path.join(
  __dirname,
  "..",
  "apps",
  "web-v2",
  "lib",
  "i18n",
  "messages",
);

fs.mkdirSync(OUT_DIR, { recursive: true });

const LOCALES = ["en", "es", "fr", "de", "pt", "zh", "ja", "ko", "ar", "hi"];

for (const locale of LOCALES) {
  const messages = locale === "de" ? BASE.de : BASE.en;
  const target = path.join(OUT_DIR, `${locale}.json`);
  fs.writeFileSync(target, JSON.stringify(messages, null, 2) + "\n", "utf8");
  console.log(`[${locale}] wrote ${target}`);
}
console.log("Done.");
