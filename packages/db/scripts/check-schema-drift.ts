/**
 * CI guardrail for Task #182.
 *
 * Walks every `packages/db/src/schema/*.ts` looking for `pgTable("name", …)`
 * declarations, then ensures each table name appears in at least one
 * `CREATE TABLE … "name"` (or unquoted `CREATE TABLE … name`) statement
 * across the migration files in `packages/db/drizzle/*.sql`. The point
 * is to catch the failure mode where a table was added to the Drizzle
 * schema and `db:push`-ed into dev without anyone authoring a migration
 * — those tables are invisible to fresh DBs and fail in CI / staging.
 *
 * Exits 1 with a diff if any pgTable() lacks a CREATE TABLE statement.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const repoDb = path.resolve(here, "..");
const schemaDir = path.join(repoDb, "src", "schema");
const migrationsDir = path.join(repoDb, "drizzle");

function listFiles(dir: string, ext: string): string[] {
  return fs.readdirSync(dir)
    .filter((f) => f.endsWith(ext))
    .map((f) => path.join(dir, f));
}

interface DeclaredTable {
  name: string;
  schemaFile: string;
}

const PG_TABLE_RE = /pgTable\(\s*["']([a-zA-Z0-9_]+)["']/g;

function collectDeclaredTables(): DeclaredTable[] {
  const out: DeclaredTable[] = [];
  for (const file of listFiles(schemaDir, ".ts")) {
    const src = fs.readFileSync(file, "utf8");
    for (const m of src.matchAll(PG_TABLE_RE)) {
      out.push({ name: m[1], schemaFile: path.relative(repoDb, file) });
    }
  }
  return out;
}

function loadMigrationCorpus(): string {
  return listFiles(migrationsDir, ".sql")
    .map((f) => fs.readFileSync(f, "utf8"))
    .join("\n\n");
}

function migrationHasCreateTable(corpus: string, name: string): boolean {
  // Match  CREATE TABLE [IF NOT EXISTS] "name" / `name` / name
  // The trailing word-boundary is only meaningful for the unquoted form;
  // adding `\b` after a `"` would never match because `"` and the next
  // char (space / `(`) are both non-word characters.
  const re = new RegExp(
    `CREATE\\s+TABLE\\s+(?:IF\\s+NOT\\s+EXISTS\\s+)?(?:"${name}"|\`${name}\`|${name}\\b)`,
    "i",
  );
  return re.test(corpus);
}

function main(): void {
  const declared = collectDeclaredTables();
  const corpus = loadMigrationCorpus();
  const missing = declared.filter((d) => !migrationHasCreateTable(corpus, d.name));
  if (missing.length === 0) {
    console.log(`[check:schema-drift] OK — ${declared.length} pgTable() declarations all have a CREATE TABLE in packages/db/drizzle/.`);
    return;
  }
  console.error("[check:schema-drift] FAIL — these tables are declared in packages/db/src/schema/ but never created by a migration:");
  for (const m of missing) {
    console.error(`  - ${m.name}  (declared in ${m.schemaFile})`);
  }
  console.error("\nFix by adding the table to a migration (drizzle-kit generate) or by removing the unused pgTable() declaration.");
  process.exit(1);
}

main();
