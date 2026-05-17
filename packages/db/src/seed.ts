import { createDb } from "./index.js";
import { tenants, users } from "./schema/index.js";
import { sql } from "drizzle-orm";
import crypto from "crypto";

async function seed() {
  const url = process.env.DATABASE_URL;
  if (!url) { console.error("DATABASE_URL not set"); process.exit(1); }
  const db = createDb(url);

  const existing = await db.select().from(tenants).limit(1);
  if (existing.length > 0) {
    console.log("Database already seeded. Skipping.");
    process.exit(0);
  }

  const [tenant] = await db.insert(tenants).values({
    name: "AIVO Demo Family",
    type: "B2C_FAMILY",
  }).returning();

  const passwordHash = crypto.createHash("sha256").update("admin123").digest("hex");

  await db.insert(users).values({
    tenantId: tenant.id,
    email: "admin@aivo.dev",
    passwordHash,
    name: "AIVO Admin",
    role: "PLATFORM_ADMIN",
    emailVerified: true,
  });

  console.log("Seed complete. Tenant:", tenant.id);
  process.exit(0);
}

seed().catch(console.error);
