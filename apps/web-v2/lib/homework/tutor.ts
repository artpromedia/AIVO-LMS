import type { HomeworkHelpMessage } from "@/lib/db/types";
import { serverEnv } from "@/lib/env";
import { callService } from "@/lib/services/client";

export type SubjectSlug = "reading" | "math" | "writing" | "science" | "social" | "life" | "art";

export function classifySubject(topic: string): SubjectSlug | null {
  const t = topic.toLowerCase();
  if (/\b\d+\s*[+\-*/x×÷]\s*\d+|add|subtract|multiply|divide|fraction|times table|equation/.test(t))
    return "math";
  if (/spell|word|sentence|paragraph|essay|story|reading|book|grammar|verb|noun/.test(t))
    return /spell|paragraph|essay|sentence/.test(t) ? "writing" : "reading";
  if (/plant|animal|weather|experiment|cell|gravity|science/.test(t)) return "science";
  if (/friend|feel|share|emotion|kind|teamwork/.test(t)) return "social";
  if (/routine|chore|brush|clean|organize/.test(t)) return "life";
  if (/draw|color|paint|art|design/.test(t)) return "art";
  return null;
}

type GuidedReplyInput = {
  topic: string;
  subjectId: string | null;
  turn: number;
  latestLearnerMessage?: string;
  learnerId?: string;
  tenantId?: string;
  functioningLevel?: string;
  /**
   * The learner's stored language from enrollment (web-v2 system of record —
   * `web_learner_profiles.primary_language`). Free text: a locale code ("es")
   * OR a language name ("Spanish"). Forwarded into `brain_context.language_profile`
   * so ai-svc's prompt builder delivers the tutor turn in the learner's language
   * (it resolves names→locales and falls back to English when absent/unknown).
   */
  primaryLanguage?: string | null;
};

type HomeworkChatResponse = {
  response: string;
  model: string;
};

function deterministicGuidedReply(
  input: GuidedReplyInput,
): Pick<HomeworkHelpMessage, "text" | "guidedOnly"> {
  const { topic, turn, latestLearnerMessage } = input;
  const subj = classifySubject(topic);
  if (turn === 0) {
    return {
      guidedOnly: true,
      text:
        subj === "math"
          ? "That looks like a math problem. What have you tried so far?"
          : subj === "writing"
            ? "Read it out loud once. What part feels tricky?"
            : subj === "reading"
              ? "Tell me one thing you already know about it."
              : "What part feels hardest right now?",
    };
  }
  if (turn === 1) {
    return {
      guidedOnly: true,
      text:
        subj === "math"
          ? "Let's break it into steps. What is the first number you would write down?"
          : subj === "writing"
            ? "Try saying the sentence out loud. Which word does not sound right?"
            : "Tell me the first step you would try. I will help you check it.",
    };
  }
  const learnerHint = latestLearnerMessage?.slice(0, 120) ?? "";
  return {
    guidedOnly: true,
    text:
      subj === "math"
        ? `Check your work: does the result feel about the right size? ${learnerHint ? `You said: ${learnerHint}.` : ""}`
        : "Read back what you wrote. Does it match what you meant to say?",
  };
}

function useLiveAgent(): boolean {
  if (serverEnv.NODE_ENV === "production") return true;
  return serverEnv.AIVO_USE_AI_SVC ?? serverEnv.AIVO_USE_SERVICE_STACK;
}

export async function generateGuidedReply(
  input: GuidedReplyInput,
): Promise<Pick<HomeworkHelpMessage, "text" | "guidedOnly">> {
  if (!useLiveAgent()) return deterministicGuidedReply(input);
  if (serverEnv.NODE_ENV === "production" && !serverEnv.INTERNAL_AI_TOKEN) {
    throw new Error("INTERNAL_AI_TOKEN is required for production homework tutor calls");
  }

  const result = await callService<HomeworkChatResponse>({
    service: "ai-svc",
    baseUrl: serverEnv.AI_SVC_URL,
    url: "/api/ai/homework/chat",
    method: "POST",
    headers: serverEnv.INTERNAL_AI_TOKEN
      ? { "X-Internal-Auth": serverEnv.INTERNAL_AI_TOKEN }
      : undefined,
    body: {
      tutor_sku: `ADDON_TUTOR_${(input.subjectId ?? classifySubject(input.topic) ?? "GENERAL").toUpperCase()}`,
      learner_id: input.learnerId ?? "unknown",
      functioning_level: input.functioningLevel ?? "STANDARD",
      brain_context: {
        learner_id: input.learnerId,
        tenant_id: input.tenantId,
        // Forward the enrolled language so ai-svc delivers in the learner's
        // language. web-v2 is the system of record for learner data and does
        // NOT seed brain-svc, so the language must travel in this payload —
        // there is no brain-svc `/context` language_profile to read for these
        // learners. ai-svc prefers `preferred_instruction_language`, then
        // `primary_language`; enrollment captures exactly one field.
        ...(input.primaryLanguage && input.primaryLanguage.trim()
          ? { language_profile: { primary_language: input.primaryLanguage.trim() } }
          : {}),
      },
      homework_context: {
        subject: input.subjectId ?? classifySubject(input.topic) ?? "general",
        adapted_problems: [{ problem_number: 1, adapted: input.topic }],
      },
      messages: [
        {
          role: "user",
          content:
            input.latestLearnerMessage ??
            `Help me get started on this topic without giving me the answer: ${input.topic}`,
        },
      ],
      max_tokens: 500,
    },
    retries: 1,
  });

  if (result.ok && result.data.response.trim()) {
    return { text: result.data.response.trim(), guidedOnly: true };
  }
  if (serverEnv.NODE_ENV === "production") {
    throw new Error(
      `ai-svc homework tutor unavailable: ${result.ok ? "empty response" : result.message}`,
    );
  }
  return deterministicGuidedReply(input);
}

export function buildHomeworkInsight(topic: string, messageCount: number): string {
  const subj = classifySubject(topic);
  const base = `Worked through a ${subj ?? "general"} problem about "${topic}".`;
  if (messageCount >= 4)
    return `${base} The learner worked through several back-and-forth steps with the tutor.`;
  if (messageCount >= 2)
    return `${base} The learner asked for help and worked through a couple of guiding steps.`;
  return `${base} A short check-in; the learner asked for help and got started.`;
}
