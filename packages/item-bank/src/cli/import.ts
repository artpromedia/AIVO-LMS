/**
 * Sprint 2.2 — item-bank import pipeline.
 *
 * `runImport({ inputDir, persist })` walks a directory of JSON / YAML
 * item files, validates each one against the authoring schema, and
 * pushes the resulting `AuthoredItem`s into a `persist()` adapter
 * (typically the assessment-svc's Prisma client). The adapter is an
 * injection point so we can dry-run from CI without a database, and
 * unit-test the importer with an in-memory map.
 *
 * The function also emits a coverage report and returns the full set
 * of validation issues so the caller (`bin.ts`) can pretty-print
 * them.
 */
import { promises as fs } from "node:fs";
import * as path from "node:path";
import {
  AuthoredItem,
  AuthoredItemBank,
  buildCoverageReport,
  ITEM_BANK_SCHEMA_VERSION,
  type CoverageReport,
} from "../schema.js";

export interface ImportIssue {
  file: string;
  itemId?: string;
  detail: string;
}

export interface ImportSummary {
  bankId: string | null;
  imported: AuthoredItem[];
  failed: ImportIssue[];
  coverage: CoverageReport;
}

export interface PersistAdapter {
  /**
   * Persist a validated item. Adapters are expected to be idempotent —
   * re-importing the same file is a common dev workflow. Return the
   * persisted id (typically equal to `item.id`, but a Prisma-backed
   * adapter may rewrite it).
   */
  upsertItem(item: AuthoredItem, bankId: string | null): Promise<string>;
}

export const NULL_PERSIST_ADAPTER: PersistAdapter = {
  async upsertItem(item) {
    return item.id;
  },
};

const SUPPORTED_EXTS = new Set([".json", ".yaml", ".yml"]);

async function readEntries(dir: string): Promise<string[]> {
  const out: string[] = [];
  const stack = [dir];
  while (stack.length > 0) {
    const current = stack.pop()!;
    const dirents = await fs.readdir(current, { withFileTypes: true });
    for (const ent of dirents) {
      const full = path.join(current, ent.name);
      if (ent.isDirectory()) {
        stack.push(full);
      } else if (SUPPORTED_EXTS.has(path.extname(ent.name).toLowerCase())) {
        out.push(full);
      }
    }
  }
  return out.sort();
}

function parseFileContents(filename: string, raw: string): unknown {
  const ext = path.extname(filename).toLowerCase();
  if (ext === ".json") return JSON.parse(raw);
  if (ext === ".yaml" || ext === ".yml") {
    // Minimal YAML support — we only accept the subset our authoring
    // template uses. The full `yaml` dependency adds ~80kB so we keep
    // it optional: if the host has it, prefer it; otherwise fall back
    // to a tiny line-based parser that handles `key: value` and
    // `- list` items. Authoring conventions: use JSON for anything
    // complex; YAML only for the readable top-level layout.
    return parseTinyYaml(raw);
  }
  throw new Error(`Unsupported extension: ${ext}`);
}

/**
 * Minimal YAML subset: scalar values, simple lists, and nested maps.
 * Not a full parser. For richer YAML, write `.json`.
 */
function parseTinyYaml(input: string): unknown {
  type AnyObj = Record<string, unknown>;
  const lines = input
    .split(/\r?\n/)
    .map((l) => l.replace(/#.*$/, "").trimEnd())
    .filter((l) => l.trim().length > 0);

  type Frame = { indent: number; container: unknown; key?: string };
  const root: AnyObj = {};
  const stack: Frame[] = [{ indent: -1, container: root }];

  function castScalar(v: string): unknown {
    if (v === "true") return true;
    if (v === "false") return false;
    if (v === "null" || v === "~") return null;
    if (/^-?\d+$/.test(v)) return parseInt(v, 10);
    if (/^-?\d+\.\d+$/.test(v)) return parseFloat(v);
    if (
      (v.startsWith('"') && v.endsWith('"')) ||
      (v.startsWith("'") && v.endsWith("'"))
    ) {
      return v.slice(1, -1);
    }
    return v;
  }

  for (const raw of lines) {
    const indent = raw.match(/^ */)![0].length;
    const line = raw.trim();
    while (stack.length > 1 && stack[stack.length - 1].indent >= indent) stack.pop();
    const top = stack[stack.length - 1];
    const container = top.container;

    if (line.startsWith("- ")) {
      const value = line.slice(2);
      if (!Array.isArray(container)) {
        throw new Error("YAML list item outside of array context");
      }
      if (value.includes(": ")) {
        const obj: AnyObj = {};
        const [k, ...rest] = value.split(": ");
        obj[k.trim()] = castScalar(rest.join(": ").trim());
        container.push(obj);
        stack.push({ indent, container: obj });
      } else {
        container.push(castScalar(value));
      }
      continue;
    }

    const colonIdx = line.indexOf(":");
    if (colonIdx < 0) {
      throw new Error(`Unrecognised YAML line: ${raw}`);
    }
    const key = line.slice(0, colonIdx).trim();
    const rhs = line.slice(colonIdx + 1).trim();
    if (Array.isArray(container)) {
      // Inline key/value into the previous map. Skip — handled above.
      continue;
    }
    const map = container as AnyObj;
    if (rhs.length === 0) {
      // Decide between an object or a list based on the next line.
      map[key] = {} as AnyObj; // tentative
      stack.push({ indent, container: map[key], key });
      // Hack: if next non-empty line starts with "- " under deeper
      // indent, switch to array. Find peek line:
      const idx = lines.indexOf(raw);
      const next = lines[idx + 1];
      if (next && next.trim().startsWith("- ") && next.match(/^ */)![0].length > indent) {
        map[key] = [];
        stack[stack.length - 1].container = map[key];
      }
    } else {
      map[key] = castScalar(rhs);
    }
  }
  return root;
}

function isBank(v: unknown): v is { schemaVersion: number; id: string; items: unknown[] } {
  if (!v || typeof v !== "object") return false;
  const o = v as Record<string, unknown>;
  return (
    typeof o.id === "string" &&
    typeof o.schemaVersion === "number" &&
    Array.isArray(o.items)
  );
}

export interface ImportOptions {
  inputDir: string;
  persist?: PersistAdapter;
  /** When set, items whose subjectSlug is not in this list are rejected. */
  allowedSubjects?: string[];
  /** Optional skill-id allowlist for the coverage report. */
  knownSkillIds?: string[];
}

export async function runImport(opts: ImportOptions): Promise<ImportSummary> {
  const persist = opts.persist ?? NULL_PERSIST_ADAPTER;
  const allowed = opts.allowedSubjects ? new Set(opts.allowedSubjects) : null;

  const files = await readEntries(opts.inputDir);
  const imported: AuthoredItem[] = [];
  const failed: ImportIssue[] = [];
  let bankId: string | null = null;

  for (const file of files) {
    let raw: string;
    try {
      raw = await fs.readFile(file, "utf8");
    } catch (err) {
      failed.push({ file, detail: `Could not read: ${(err as Error).message}` });
      continue;
    }
    let payload: unknown;
    try {
      payload = parseFileContents(file, raw);
    } catch (err) {
      failed.push({ file, detail: `Parse error: ${(err as Error).message}` });
      continue;
    }

    if (isBank(payload)) {
      const parsed = AuthoredItemBank.safeParse(payload);
      if (!parsed.success) {
        failed.push({ file, detail: formatZodIssues(parsed.error.issues) });
        continue;
      }
      bankId = parsed.data.id;
      for (const item of parsed.data.items) {
        await tryPersist(item, file, allowed, persist, bankId, imported, failed);
      }
      continue;
    }

    const parsed = AuthoredItem.safeParse(payload);
    if (!parsed.success) {
      failed.push({ file, detail: formatZodIssues(parsed.error.issues) });
      continue;
    }
    await tryPersist(parsed.data, file, allowed, persist, bankId, imported, failed);
  }

  const coverage = buildCoverageReport(imported, opts.knownSkillIds ?? []);
  return { bankId, imported, failed, coverage };
}

async function tryPersist(
  item: AuthoredItem,
  file: string,
  allowed: Set<string> | null,
  persist: PersistAdapter,
  bankId: string | null,
  imported: AuthoredItem[],
  failed: ImportIssue[],
) {
  if (allowed && !allowed.has(item.subjectSlug)) {
    failed.push({
      file,
      itemId: item.id,
      detail: `subjectSlug "${item.subjectSlug}" not in allowedSubjects`,
    });
    return;
  }
  try {
    await persist.upsertItem(item, bankId);
    imported.push(item);
  } catch (err) {
    failed.push({ file, itemId: item.id, detail: `Persist failed: ${(err as Error).message}` });
  }
}

function formatZodIssues(issues: { path: (string | number)[]; message: string }[]): string {
  return issues.map((i) => `  ${i.path.join(".") || "<root>"}: ${i.message}`).join("\n");
}

export { ITEM_BANK_SCHEMA_VERSION };
