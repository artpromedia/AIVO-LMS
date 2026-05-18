"use server";

import { requirePageRole } from "@/lib/auth/server";

export type PlaygroundInput = {
  systemPrompt: string;
  prompt: string;
  model: "claude-opus-4-7" | "gemini-3-pro" | "gpt-5-5";
};

export type PlaygroundResult = {
  decision: "allow" | "review" | "block";
  output: string;
  modelUsed: PlaygroundInput["model"];
  latencyMs: number;
  tokensIn: number;
  tokensOut: number;
  estimatedCostUsd: number;
  flags: string[];
};

const COST_PER_1K: Record<PlaygroundInput["model"], { in: number; out: number }> = {
  "claude-opus-4-7": { in: 0.015, out: 0.075 },
  "gemini-3-pro": { in: 0.00175, out: 0.007 },
  "gpt-5-5": { in: 0.005, out: 0.02 },
};

const INJECTION_PATTERNS = [
  /ignore (?:all )?previous instructions?/i,
  /reveal (?:the )?system prompt/i,
  /disregard your guidelines/i,
];

const CRISIS_PATTERNS = [/suicid/i, /self[- ]harm/i, /kill (?:my|your)self/i];

/**
 * Stand-in for the real ai-svc + safety pipeline. Deterministic enough for a
 * platform-admin playground demo: applies the same shape of safety check
 * (injection + crisis), simulates latency and token counts, and produces a
 * tutor-style response. The wire-up to the actual LiteLLM-backed ai-svc is a
 * body-only swap.
 */
export async function runPlaygroundPrompt(input: PlaygroundInput): Promise<PlaygroundResult> {
  await requirePageRole(["platform_admin"]);

  const flags: string[] = [];
  // Collect all signals first, then apply severity ordering at the end so a
  // later weaker signal can never downgrade a stronger earlier one.
  const hits: Array<PlaygroundResult["decision"]> = [];
  if (INJECTION_PATTERNS.some((p) => p.test(input.prompt))) {
    hits.push("block");
    flags.push("prompt_injection");
  }
  if (CRISIS_PATTERNS.some((p) => p.test(input.prompt))) {
    hits.push("review");
    flags.push("crisis_signal");
  }
  if (input.prompt.trim().length < 4) {
    flags.push("short_prompt");
  }
  // Severity: block > review > allow.
  const decision: PlaygroundResult["decision"] = hits.includes("block")
    ? "block"
    : hits.includes("review")
      ? "review"
      : "allow";

  // Simulated network + model latency.
  const latencyMs = 280 + Math.floor(Math.random() * 480);
  await new Promise((r) => setTimeout(r, Math.min(latencyMs, 900)));

  const tokensIn = Math.ceil((input.systemPrompt.length + input.prompt.length) / 4);
  const tokensOut = decision === "block" ? 0 : 80 + Math.floor(Math.random() * 220);
  const rates = COST_PER_1K[input.model];
  const estimatedCostUsd = (tokensIn / 1000) * rates.in + (tokensOut / 1000) * rates.out;

  const output =
    decision === "block"
      ? "[blocked] This prompt was rejected by the safety pipeline before it reached an LLM."
      : decision === "review"
        ? "[review] Your prompt triggered a crisis-language pattern. In production this would route to a safety-trained model and open a human-review case before any output is shown to a learner."
        : buildMockResponse(input.prompt);

  return {
    decision,
    output,
    modelUsed: input.model,
    latencyMs,
    tokensIn,
    tokensOut,
    estimatedCostUsd,
    flags,
  };
}

function buildMockResponse(prompt: string): string {
  const trimmed = prompt.trim().replace(/\s+/g, " ");
  return [
    "Great question — let's break it down together.",
    "",
    `You asked: "${trimmed.length > 140 ? `${trimmed.slice(0, 140)}…` : trimmed}"`,
    "",
    "Here's how I'd think about it step by step:",
    "1. Start with what you already know.",
    "2. Find the one new idea in the question.",
    "3. Try it on a small example first, then build up.",
    "",
    "Want to try an example together?",
  ].join("\n");
}
