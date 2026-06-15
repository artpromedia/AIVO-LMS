/**
 * Three-way key-level merge for conflicted i18n JSON files.
 * For each conflicted file: reads base (stage 1), ours (stage 2), theirs (stage 3)
 * from the git index, deep-merges, writes the result, and stages it.
 * Conflict rule: if both sides changed the same leaf differently, THEIRS wins
 * (logged) — i18n strings are non-code and the newer branch usually has the
 * fuller copy; review the log for anything surprising.
 */
const { execSync } = require("node:child_process");
const { writeFileSync } = require("node:fs");

const files = process.argv.slice(2);
if (files.length === 0) {
  console.error("usage: node merge-i18n-conflicts.cjs <file...>");
  process.exit(1);
}

function show(stage, file) {
  try {
    return JSON.parse(
      execSync(`git show :${stage}:"${file}"`, { maxBuffer: 64 * 1024 * 1024 }).toString("utf8"),
    );
  } catch {
    return null;
  }
}

const isObj = (v) => v !== null && typeof v === "object" && !Array.isArray(v);

function merge(base, ours, theirs, path, log) {
  if (!isObj(ours) || !isObj(theirs)) {
    // leaf or type mismatch
    const o = JSON.stringify(ours);
    const t = JSON.stringify(theirs);
    const b = JSON.stringify(base);
    if (o === t) return ours;
    if (t === b) return ours; // only ours changed
    if (o === b) return theirs; // only theirs changed
    log.push(`BOTH-CHANGED ${path}: ours=${o} theirs=${t} -> theirs`);
    return theirs;
  }
  const out = {};
  const keys = new Set([...Object.keys(ours), ...Object.keys(theirs)]);
  for (const k of keys) {
    const p = path ? `${path}.${k}` : k;
    const bv = isObj(base) ? base[k] : undefined;
    const ov = ours[k];
    const tv = theirs[k];
    if (ov === undefined) {
      // ours lacks it: added by theirs, or deleted by ours
      if (bv === undefined) out[k] = tv; // theirs added
      else if (JSON.stringify(tv) !== JSON.stringify(bv)) {
        log.push(`OURS-DELETED/THEIRS-CHANGED ${p} -> keep theirs`);
        out[k] = tv;
      } // else: ours deleted, theirs unchanged -> stay deleted
    } else if (tv === undefined) {
      if (bv === undefined) out[k] = ov; // ours added
      else if (JSON.stringify(ov) !== JSON.stringify(bv)) {
        log.push(`THEIRS-DELETED/OURS-CHANGED ${p} -> keep ours`);
        out[k] = ov;
      }
    } else {
      out[k] = merge(bv, ov, tv, p, log);
    }
  }
  return out;
}

for (const file of files) {
  const base = show(1, file);
  const ours = show(2, file);
  const theirs = show(3, file);
  if (!ours || !theirs) {
    console.error(`SKIP ${file}: missing stages (not a content conflict?)`);
    process.exitCode = 1;
    continue;
  }
  const log = [];
  const merged = merge(base ?? {}, ours, theirs, "", log);
  writeFileSync(file, JSON.stringify(merged, null, 2) + "\n", "utf8");
  execSync(`git add "${file}"`);
  console.log(`MERGED ${file}${log.length ? ` (${log.length} both-changed)` : ""}`);
  for (const l of log) console.log(`  ${l}`);
}
