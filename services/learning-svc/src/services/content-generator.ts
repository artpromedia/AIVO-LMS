import { TUTORS } from "@aivo/brand";

const IS_PROD = process.env.NODE_ENV === "production";
function requireUrl(name: string, devDefault: string): string {
  const v = process.env[name];
  if (v) return v;
  if (IS_PROD) throw new Error(`learning-svc: ${name} must be set in production`);
  return devDefault;
}
const AI_SVC_URL = requireUrl("AI_SVC_URL", "http://localhost:3004");
const BRAIN_SVC_URL = requireUrl("BRAIN_SVC_URL", "http://localhost:3002");

export interface PersonalizedTopic {
  topic: string;
  standard_codes?: string[];
  prerequisite_topics?: string[];
  estimated_sessions?: number;
  difficulty?: number;
  description?: string;
}

/**
 * Best-effort call to brain-svc curriculum engine. Returns null on any failure
 * so callers can fall back to static defaults silently.
 */
export async function fetchPersonalizedTopics(params: {
  learnerId: string;
  subject: string;
  currentMastery?: number;
  completedTopics?: string[];
  authHeader?: string;
  signal?: AbortSignal;
}): Promise<PersonalizedTopic[] | null> {
  try {
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (params.authHeader) headers["Authorization"] = params.authHeader;
    const res = await fetch(
      `${BRAIN_SVC_URL}/api/brain/curriculum/${params.learnerId}/topic-sequence`,
      {
        method: "POST",
        headers,
        body: JSON.stringify({
          subject: params.subject,
          current_mastery: params.currentMastery ?? 0,
          completed_topics: params.completedTopics ?? [],
        }),
        signal: params.signal,
      },
    );
    if (!res.ok) return null;
    const data = await res.json();
    const topics = data?.topics;
    if (!Array.isArray(topics) || topics.length === 0) return null;
    return topics as PersonalizedTopic[];
  } catch {
    return null;
  }
}

export async function generateLessonContent(params: {
  subject: string;
  topic: string;
  gradeTarget: string;
  deliveryLevel: string;
  functioningLevel: string;
  brainContext: Record<string, unknown>;
  contentType?: string;
  /** Live mastery signals from the local model (P0). Forwarded to prompt_builder's adaptive
   * block; omitted entirely when the model flag is off so the request is byte-identical to today. */
  currentMastery?: number;
  masteryTrend?: string;
}): Promise<{
  content: string;
  model: string;
  promptTokens: number;
  completionTokens: number;
  qualityScore: number;
  qualityGatePassed: boolean;
  qualityGateLog: Record<string, unknown>;
}> {
  const res = await fetch(`${AI_SVC_URL}/api/ai/generate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      subject: params.subject,
      topic: params.topic,
      grade_target: params.gradeTarget,
      delivery_level: params.deliveryLevel,
      functioning_level: params.functioningLevel,
      brain_context: params.brainContext,
      content_type: params.contentType || "LESSON",
      ...(params.currentMastery !== undefined ? { current_mastery: params.currentMastery } : {}),
      ...(params.masteryTrend !== undefined ? { mastery_trend: params.masteryTrend } : {}),
    }),
  });

  if (!res.ok) {
    throw new Error(`ai-svc returned ${res.status}: ${await res.text()}`);
  }

  const data = await res.json();
  return {
    content: data.content,
    model: data.model,
    promptTokens: data.prompt_tokens,
    completionTokens: data.completion_tokens,
    qualityScore: data.quality_score,
    qualityGatePassed: data.quality_gate_passed,
    qualityGateLog: data.quality_gate_log,
  };
}

export async function chatWithTutor(params: {
  tutorSku: string;
  learnerId: string;
  functioningLevel: string;
  brainContext: Record<string, unknown>;
  messages: Array<{ role: string; content: string }>;
}): Promise<{
  response: string;
  model: string;
  promptTokens: number;
  completionTokens: number;
}> {
  const res = await fetch(`${AI_SVC_URL}/api/ai/tutor/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      tutor_sku: params.tutorSku,
      learner_id: params.learnerId,
      functioning_level: params.functioningLevel,
      brain_context: params.brainContext,
      messages: params.messages,
    }),
  });

  if (!res.ok) {
    throw new Error(`ai-svc tutor chat returned ${res.status}: ${await res.text()}`);
  }

  const data = await res.json();
  return {
    response: data.response,
    model: data.model,
    promptTokens: data.prompt_tokens,
    completionTokens: data.completion_tokens,
  };
}

const SKU_TO_KEY: Record<string, string> = {
  ADDON_TUTOR_MATH: "nova",
  ADDON_TUTOR_ELA: "sage",
  ADDON_TUTOR_SCIENCE: "spark",
  ADDON_TUTOR_HISTORY: "chrono",
  ADDON_TUTOR_CODING: "pixel",
  ADDON_TUTOR_SPEECH: "echo",
  ADDON_TUTOR_SEL: "harmony",
  ADDON_TUTOR_SOCIAL_STUDIES: "atlas",
  ADDON_TUTOR_ARTS: "cadence",
  ADDON_TUTOR_PE_HEALTH: "vigor",
  ADDON_TUTOR_LANGUAGES: "lingua",
  ADDON_TUTOR_STEM_DESIGN: "forge",
  ADDON_TUTOR_LIFE_SKILLS: "compass",
  ADDON_TUTOR_CREATIVE_WRITING: "muse",
};

export function getSubjectForTutor(tutorSku: string): string {
  const key = SKU_TO_KEY[tutorSku];
  if (key) {
    const tutor = TUTORS[key as keyof typeof TUTORS];
    if (tutor) return tutor.domain;
  }
  return "General";
}
