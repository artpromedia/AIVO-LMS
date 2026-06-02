// Inject marketing.home.* keys into all 10 locale message files.
// Run with: node scripts/inject-marketing-home-keys.cjs
const fs = require("node:fs");
const path = require("node:path");

const KEYS = require("./i18n-home-keys.json");
const MESSAGES_DIR = path.join(__dirname, "..", "apps", "marketing", "src", "i18n", "messages");

const LOCALES = ["en", "es", "fr", "de", "pt", "zh", "ja", "ko", "ar", "hi"];

for (const locale of LOCALES) {
  const filePath = path.join(MESSAGES_DIR, `${locale}.json`);
  const raw = fs.readFileSync(filePath, "utf8");
  const json = JSON.parse(raw);
  json.marketing = json.marketing || {};
  const home = locale === "de" ? KEYS.de : KEYS.en;
  // Preserve any existing keys; new ones override.
  json.marketing.home = { ...(json.marketing.home || {}), ...home };
  fs.writeFileSync(filePath, JSON.stringify(json, null, 2) + "\n", "utf8");
  console.log(`[${locale}] marketing.home keys: ${Object.keys(json.marketing.home).length}`);
}
console.log("Done.");
