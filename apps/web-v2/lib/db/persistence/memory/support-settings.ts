/**
 * In-memory SupportStore + SettingsStore — wrap supportTickets /
 * aiGenerationJobs / tenantSettings / platform* Maps. Test-only; the repo
 * layer owns filtering/sorting + scope checks. Tenant settings keyed by
 * tenantId.
 */
import { getStore } from "@/lib/db/store";
import type {
  AiGenerationJob,
  PlatformApiKey,
  PlatformEmailTemplate,
  PlatformWebhookEndpoint,
  SupportTicket,
  TenantSettings,
} from "@/lib/db/types";
import type { SettingsStore, SupportStore } from "../types";

export const memorySupport: SupportStore = {
  async listSupportTickets(): Promise<SupportTicket[]> {
    return Array.from(getStore().supportTickets.values());
  },
  async getSupportTicket(id) {
    return getStore().supportTickets.get(id) ?? null;
  },
  async upsertSupportTicket(ticket) {
    getStore().supportTickets.set(ticket.id, ticket);
    return ticket;
  },
  async listAiGenerationJobs(): Promise<AiGenerationJob[]> {
    return Array.from(getStore().aiGenerationJobs.values());
  },
  async appendAiGenerationJob(job) {
    getStore().aiGenerationJobs.set(job.id, job);
    return job;
  },
};

export const memorySettings: SettingsStore = {
  async getTenantSettings(tenantId): Promise<TenantSettings | null> {
    return getStore().tenantSettings.get(tenantId) ?? null;
  },
  async upsertTenantSettings(settings) {
    getStore().tenantSettings.set(settings.tenantId, settings);
    return settings;
  },
  async listPlatformApiKeys(): Promise<PlatformApiKey[]> {
    return Array.from(getStore().platformApiKeys.values());
  },
  async listPlatformEmailTemplates(): Promise<PlatformEmailTemplate[]> {
    return Array.from(getStore().platformEmailTemplates.values());
  },
  async listPlatformWebhookEndpoints(): Promise<PlatformWebhookEndpoint[]> {
    return Array.from(getStore().platformWebhookEndpoints.values());
  },
};
