import { buildAuditContext, type AuditContext, type RequestContext } from "@aivo/enterprise-core";
import type { BrainSnapshot, ProfileRecommendation } from "./types.js";

export interface RecommendationAuditEntry extends AuditContext {
  recommendationId: string;
  recommendationType: string;
  beforeHash?: string;
  afterHash?: string;
}

function shallowHash(value: Record<string, unknown> | undefined): string {
  if (!value) return "";
  try {
    return Buffer.from(JSON.stringify(value)).toString("base64").slice(0, 32);
  } catch {
    return "";
  }
}

export function buildRecommendationAuditEntry(
  request: RequestContext,
  recommendation: ProfileRecommendation,
  action: string,
  snapshot?: BrainSnapshot,
): RecommendationAuditEntry {
  const audit = buildAuditContext({
    request,
    action,
    resourceType: "profile_recommendation",
    resourceId: recommendation.id,
    learnerId: recommendation.learnerId,
  });
  return {
    ...audit,
    recommendationId: recommendation.id,
    recommendationType: recommendation.type,
    beforeHash: snapshot ? shallowHash(snapshot.before) : undefined,
    afterHash: snapshot ? shallowHash(snapshot.after) : undefined,
  };
}
