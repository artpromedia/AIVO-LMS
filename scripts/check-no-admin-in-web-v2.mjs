import { existsSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const adminTree = join(root, "apps", "web-v2", "app", "admin");

if (existsSync(adminTree)) {
  console.error("apps/web-v2/app/admin still exists. Move admin routes to apps/web-admin before cutting over.");
  process.exit(1);
}
