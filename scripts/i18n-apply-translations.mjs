#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";

const APP = process.argv[2] || "web";
const TRANS_FILE = process.argv[3];
const AUDIT_FILE = process.argv[4]; // optional: only apply where currently untranslated per audit
if (!TRANS_FILE) {
  console.error("usage: i18n-apply-translations.mjs <app> <translations.json> [audit.json]");
  process.exit(1);
}

const MSG_DIR = path.join("apps", APP, "src/i18n/messages");
const trans = JSON.parse(fs.readFileSync(TRANS_FILE, "utf8"));
const audit = AUDIT_FILE ? JSON.parse(fs.readFileSync(AUDIT_FILE, "utf8")) : null;
const allowedByLocale = audit
  ? Object.fromEntries(Object.entries(audit.locales).map(([l, d]) => [l, new Set(d.untranslated)]))
  : null;

function setNested(obj, dotKey, val) {
  const parts = dotKey.split(".");
  let cur = obj;
  for (let i = 0; i < parts.length - 1; i++) {
    if (typeof cur[parts[i]] !== "object" || cur[parts[i]] === null) cur[parts[i]] = {};
    cur = cur[parts[i]];
  }
  cur[parts[parts.length - 1]] = val;
}

const locales = Object.keys(trans);
let totalSet = 0;
for (const loc of locales) {
  const file = path.join(MSG_DIR, `${loc}.json`);
  const data = JSON.parse(fs.readFileSync(file, "utf8"));
  let count = 0,
    skipped = 0;
  const allowed = allowedByLocale ? allowedByLocale[loc] : null;
  for (const [key, val] of Object.entries(trans[loc])) {
    if (allowed && !allowed.has(key)) {
      skipped++;
      continue;
    }
    setNested(data, key, val);
    count++;
  }
  if (skipped) console.log(`  (skipped ${skipped} already-translated)`);
  fs.writeFileSync(file, JSON.stringify(data, null, 2) + "\n");
  console.log(`${loc}: applied ${count}`);
  totalSet += count;
}
console.log(`Total: ${totalSet}`);
