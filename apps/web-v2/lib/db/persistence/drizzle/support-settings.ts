/**
 * Drizzle-backed SupportStore + SettingsStore — the web_* support + settings
 * tables. Filtering/sorting + scope checks live in the repo layer; tenant
 * settings are keyed by tenantId.
 */
import { eq } from "drizzle-orm";
import {
  webSupportTickets,
  webAiGenerationJobs,
  webTenantSettings,
  webPlatformApiKeys,
  webPlatformEmailTemplates,
  webPlatformWebhookEndpoints,
} from "@aivo/db";
import type {
  AiGenerationJob,
  PlatformApiKey,
  PlatformEmailTemplate,
  PlatformWebhookEndpoint,
  SupportTicket,
  TenantSettings,
} from "@/lib/db/types";
import type { SettingsStore, SupportStore } from "../types";
import { getDb } from "./client";

export const drizzleSupport: SupportStore = {
  async listSupportTickets(): Promise<SupportTicket[]> {
    const rows = await getDb().select().from(webSupportTickets);
    return rows.map((r) => r.data as SupportTicket);
  },
  async getSupportTicket(id) {
    const [row] = await getDb()
      .select()
      .from(webSupportTickets)
      .where(eq(webSupportTickets.id, id))
      .limit(1);
    return row ? (row.data as SupportTicket) : null;
  },
  async upsertSupportTicket(ticket) {
    await getDb()
      .insert(webSupportTickets)
      .values({ id: ticket.id, tenantId: ticket.tenantId, data: ticket })
      .onConflictDoUpdate({
        target: webSupportTickets.id,
        set: { tenantId: ticket.tenantId, data: ticket },
      });
    return ticket;
  },
  async listAiGenerationJobs(): Promise<AiGenerationJob[]> {
    const rows = await getDb().select().from(webAiGenerationJobs);
    return rows.map((r) => r.data as AiGenerationJob);
  },
  async appendAiGenerationJob(job) {
    await getDb()
      .insert(webAiGenerationJobs)
      .values({ id: job.id, tenantId: job.tenantId, data: job })
      .onConflictDoNothing({ target: webAiGenerationJobs.id });
    return job;
  },
};

export const drizzleSettings: SettingsStore = {
  async getTenantSettings(tenantId): Promise<TenantSettings | null> {
    const [row] = await getDb()
      .select()
      .from(webTenantSettings)
      .where(eq(webTenantSettings.tenantId, tenantId))
      .limit(1);
    return row ? (row.data as TenantSettings) : null;
  },
  async upsertTenantSettings(settings) {
    await getDb()
      .insert(webTenantSettings)
      .values({ tenantId: settings.tenantId, data: settings })
      .onConflictDoUpdate({ target: webTenantSettings.tenantId, set: { data: settings } });
    return settings;
  },
  async listPlatformApiKeys(): Promise<PlatformApiKey[]> {
    const rows = await getDb().select().from(webPlatformApiKeys);
    return rows.map((r) => r.data as PlatformApiKey);
  },
  async listPlatformEmailTemplates(): Promise<PlatformEmailTemplate[]> {
    const rows = await getDb().select().from(webPlatformEmailTemplates);
    return rows.map((r) => r.data as PlatformEmailTemplate);
  },
  async listPlatformWebhookEndpoints(): Promise<PlatformWebhookEndpoint[]> {
    const rows = await getDb().select().from(webPlatformWebhookEndpoints);
    return rows.map((r) => r.data as PlatformWebhookEndpoint);
  },
};
