import { FastifyInstance } from "fastify";
import { leadSubmissions } from "@aivo/db";
import { eq } from "drizzle-orm";
import { createLogger } from "@aivo/observability";
import { adminSvcLeadsSchema, adminSvcNewsletterSchema } from "./schemas.js";

const logger = createLogger("admin-svc:leads");

const IS_PROD = process.env.NODE_ENV === "production";

function resolveCommsSvcUrl(): string {
  const v = process.env.COMMS_SVC_URL;
  if (v) return v;
  if (IS_PROD) throw new Error("admin-svc: COMMS_SVC_URL must be set in production");
  return "http://localhost:3010";
}

async function sendNewsletterConfirmation(email: string): Promise<void> {
  const commsSvcUrl = resolveCommsSvcUrl();
  const internalKey = process.env.INTERNAL_SERVICE_KEY || "aivo-internal-dev-key";
  try {
    await fetch(`${commsSvcUrl}/api/comms/internal/newsletter-confirm`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-internal-key": internalKey },
      body: JSON.stringify({ to: email }),
    });
  } catch (err) {
    // Fail-soft: subscription is already stored; email failure is non-fatal.
    logger.warn({ err: String(err), email }, "Newsletter confirmation email failed");
  }
}

export function registerLeadRoutes(app: FastifyInstance, db: any) {
  app.post("/api/admin-svc/leads", { schema: adminSvcLeadsSchema }, async (request, reply) => {
    const body = request.body as {
      type?: string;
      name?: string;
      email?: string;
      company?: string;
      role?: string;
      message?: string;
      schoolSize?: string;
      source?: string;
    };

    if (!body.name || !body.email) {
      return reply.status(400).send({ error: "Name and email are required" });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(body.email)) {
      return reply.status(400).send({ error: "Invalid email address" });
    }

    const validTypes = ["contact", "demo", "newsletter"];
    const type = validTypes.includes(body.type || "") ? body.type! : "contact";

    const [submission] = await db
      .insert(leadSubmissions)
      .values({
        type,
        name: body.name,
        email: body.email,
        company: body.company || null,
        role: body.role || null,
        message: body.message || null,
        schoolSize: body.schoolSize || null,
        source: body.source || "website",
      })
      .returning({ id: leadSubmissions.id });

    return { success: true, id: submission.id };
  });

  app.post("/api/admin-svc/newsletter", { schema: adminSvcNewsletterSchema }, async (request, reply) => {
    const body = request.body as { email?: string };

    if (!body.email) {
      return reply.status(400).send({ error: "Email is required" });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(body.email)) {
      return reply.status(400).send({ error: "Invalid email address" });
    }

    const existing = await db
      .select({ id: leadSubmissions.id })
      .from(leadSubmissions)
      .where(eq(leadSubmissions.email, body.email))
      .limit(1);

    if (existing.length > 0) {
      return { success: true, message: "Already subscribed" };
    }

    const [submission] = await db
      .insert(leadSubmissions)
      .values({
        type: "newsletter",
        name: body.email.split("@")[0],
        email: body.email,
        source: "website",
      })
      .returning({ id: leadSubmissions.id });

    // Fire confirmation email via comms-svc (fail-soft).
    await sendNewsletterConfirmation(body.email);

    return { success: true, id: submission.id };
  });
}
