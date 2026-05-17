/**
 * Sprint 17: Homework Helper guided tutor (stub).
 *
 * Real LLM wiring lives in Sprint 23. Until then we use a deterministic
 * mock that follows the same contract the LLM will: **guide, don't answer**.
 * For arithmetic / spelling problems the tutor explicitly withholds the
 * final answer and instead nudges the learner toward the next step.
 */
import type { HomeworkHelpMessage } from "@/lib/db/types";

export type SubjectSlug = "reading" | "math" | "writing" | "science" | "social" | "life" | "art";

/** Best-effort classifier from the topic text alone. Null when we can't tell. */
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
  /** Number of prior tutor messages, so the tutor varies its prompts. */
  turn: number;
  /** Optional latest learner message — drives clarifying vs guiding tone. */
  latestLearnerMessage?: string;
};

/**
 * Returns a guided reply that never includes the final numeric/spelling
 * answer. The mock is deterministic per (turn, subject) so tests can rely
 * on it; in production this is replaced by a prompted LLM call with the
 * same `guidedOnly` contract.
 */
export function generateGuidedReply(
  input: GuidedReplyInput,
): Pick<HomeworkHelpMessage, "text" | "guidedOnly"> {
  const { topic, turn, latestLearnerMessage } = input;
  const subj = classifySubject(topic);
  // Turn 0 = first tutor reply right after the session is created.
  if (turn === 0) {
    return {
      guidedOnly: true,
      text:
        subj === "math"
          ? `Got it — that looks like a math problem. Can you tell me what you've tried so far, even if you're not sure?`
          : subj === "writing"
            ? `Nice — writing time. Read it out loud once. What part feels tricky?`
            : subj === "reading"
              ? `Cool, a reading question. Can you tell me one thing you already know about it?`
              : `Thanks for sharing. What part feels hardest right now?`,
    };
  }
  // Mid-session: explain a concept without giving the answer.
  if (turn === 1) {
    return {
      guidedOnly: true,
      text:
        subj === "math"
          ? `Let's break it into steps. What's the very first number you'd write down? (I won't tell you the final answer — you'll find it!)`
          : subj === "writing"
            ? `Try saying the sentence out loud. Which word doesn't sound right?`
            : `Tell me the first step you'd try. I'll help you check it.`,
    };
  }
  // Later turns: prompt for self-check.
  const learnerHint = latestLearnerMessage?.slice(0, 120) ?? "";
  return {
    guidedOnly: true,
    text:
      subj === "math"
        ? `Good thinking. Now check your work: does the answer feel about the right size? ${learnerHint ? "You said: " + learnerHint + "." : ""}`
        : `You're getting closer. Read back what you wrote — does it match what you meant to say?`,
  };
}

/**
 * Builds the plain-language "insight" we store when the session ends.
 * Shown to the parent (never raw messages).
 */
export function buildHomeworkInsight(topic: string, messageCount: number): string {
  const subj = classifySubject(topic);
  const base = `Worked through a ${subj ?? "general"} problem about "${topic}".`;
  if (messageCount >= 4)
    return `${base} The learner worked through several back-and-forth steps with the tutor.`;
  if (messageCount >= 2)
    return `${base} The learner asked for help and worked through a couple of guiding steps.`;
  return `${base} A short check-in — the learner asked for help and got started.`;
}
