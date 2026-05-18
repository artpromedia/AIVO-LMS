/**
 * Tutor tool-call clients — Phase 5 specialisation surface for the
 * generic tutor runtime.
 *
 * The shared runtime keeps every tutor on the same `planSession()`
 * loop. A few tutors need authoring-specific tool calls during a
 * conversation turn — Pixel runs sandboxed code, Forge sometimes does
 * the same, Muse generates images, Cadence generates audio. Those tools
 * live in `ai-svc`; this module is the thin, type-safe HTTP client.
 *
 * Each helper enforces three things before issuing the request:
 *   1. The tutor's `TutorDefinition` declares the matching capability.
 *   2. The tutor's policy gates have already been satisfied (the route
 *      layer is responsible — these helpers do not re-check consent).
 *   3. The request body is small and JSON-serialisable.
 *
 * Network errors and non-2xx responses are surfaced as `ToolCallError`
 * so the caller can map them to a structured client response.
 */
import type { TutorCapability, TutorDefinition } from "@aivo/tutor-sdk";

const IS_PROD = process.env.NODE_ENV === "production";

function requireUrl(name: string, devDefault: string): string {
  const v = process.env[name];
  if (v) return v;
  if (IS_PROD) throw new Error(`tutor-svc: ${name} must be set in production`);
  return devDefault;
}

const AI_SVC_URL = requireUrl("AI_SVC_URL", "http://localhost:3005");
const INTERNAL_KEY = process.env.INTERNAL_SERVICE_KEY || (IS_PROD ? "" : "aivo-internal-dev-key");

export class ToolCallError extends Error {
  status: number;
  /** The capability that was being requested when the error happened. */
  capability: TutorCapability;
  constructor(msg: string, capability: TutorCapability, status = 500) {
    super(msg);
    this.status = status;
    this.capability = capability;
  }
}

function assertCapability(tutor: TutorDefinition, cap: TutorCapability): void {
  if (!tutor.capabilities.includes(cap)) {
    throw new ToolCallError(`Tutor "${tutor.id}" does not declare capability "${cap}".`, cap, 400);
  }
}

async function postTool<TReq, TRes>(
  path: string,
  body: TReq,
  capability: TutorCapability,
): Promise<TRes> {
  let res: Response;
  try {
    res = await fetch(`${AI_SVC_URL}${path}`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-internal-key": INTERNAL_KEY,
      },
      body: JSON.stringify(body),
    });
  } catch (err) {
    throw new ToolCallError(
      `ai-svc ${path} unreachable: ${err instanceof Error ? err.message : String(err)}`,
      capability,
      502,
    );
  }
  const text = await res.text();
  let parsed: unknown = null;
  try {
    parsed = text ? JSON.parse(text) : null;
  } catch {
    parsed = { raw: text };
  }
  if (!res.ok) {
    const detail =
      (typeof parsed === "object" && parsed && "detail" in parsed
        ? String((parsed as { detail?: unknown }).detail)
        : undefined) ?? res.statusText;
    throw new ToolCallError(
      `ai-svc ${path} failed (${res.status}): ${detail}`,
      capability,
      res.status,
    );
  }
  return parsed as TRes;
}

// ── code_run ────────────────────────────────────────────────────────
// Pixel and (occasionally) Forge use a sandboxed code runner to grade
// snippets and demonstrate execution. The runner enforces strict CPU /
// memory / network limits inside ai-svc; tutor-svc is a forwarder.

export type CodeRunLanguage = "python" | "javascript" | "blockly";

export interface CodeRunRequest {
  language: CodeRunLanguage;
  /** Source code to execute. Hard-capped at 8 KB by the runner. */
  source: string;
  /** Optional stdin input. */
  stdin?: string;
  /** Optional CPU/wall-time limit in ms (server enforces a hard cap). */
  timeLimitMs?: number;
}

export interface CodeRunResponse {
  stdout: string;
  stderr: string;
  exitCode: number;
  timedOut: boolean;
  durationMs: number;
}

export async function requestCodeRun(
  tutor: TutorDefinition,
  body: CodeRunRequest,
): Promise<CodeRunResponse> {
  assertCapability(tutor, "code_run");
  if (typeof body.source !== "string" || body.source.length === 0) {
    throw new ToolCallError("code_run: source is required", "code_run", 400);
  }
  if (body.source.length > 8 * 1024) {
    throw new ToolCallError("code_run: source must be under 8 KB", "code_run", 400);
  }
  return postTool<CodeRunRequest, CodeRunResponse>("/api/ai/tools/code-run", body, "code_run");
}

// ── image_out ──────────────────────────────────────────────────────
// Muse (and any other tutor declaring `image_out`) can ask ai-svc to
// generate a small illustration that the chat UI renders inline.

export interface ImageOutRequest {
  /** Plain-language prompt for the image generator. */
  prompt: string;
  /** Optional aspect ratio, e.g. "1:1", "4:3". Server clamps to a safe set. */
  aspectRatio?: string;
  /** Optional safety prefix the generator must honour
   *  (e.g. "child-safe, no human faces"). */
  safetyPrefix?: string;
}

export interface ImageOutResponse {
  /** PNG/JPEG bytes encoded base64. */
  imageBase64: string;
  /** MIME type for the bytes above. */
  mimeType: "image/png" | "image/jpeg";
  /** Generator-supplied alt text — required by WCAG 1.1.1. */
  altText: string;
}

export async function requestImageOut(
  tutor: TutorDefinition,
  body: ImageOutRequest,
): Promise<ImageOutResponse> {
  assertCapability(tutor, "image_out");
  if (typeof body.prompt !== "string" || body.prompt.trim().length === 0) {
    throw new ToolCallError("image_out: prompt is required", "image_out", 400);
  }
  return postTool<ImageOutRequest, ImageOutResponse>("/api/ai/tools/image-out", body, "image_out");
}

// ── voice_out (audio generation) ───────────────────────────────────
// Cadence uses voice_out for short rhythm/melody clips. The TTS layer
// already handles persona narration; this endpoint covers musical
// fragments and other non-speech audio.

export interface AudioOutRequest {
  /** Description of the audio to generate (rhythm pattern, melody, etc.). */
  prompt: string;
  /** Approximate duration in milliseconds. Hard-capped at 30 000 ms. */
  durationMs?: number;
  /** Optional voice/instrument style hint. */
  style?: string;
}

export interface AudioOutResponse {
  audioBase64: string;
  mimeType: "audio/mpeg" | "audio/ogg" | "audio/wav";
  durationMs: number;
}

export async function requestAudioOut(
  tutor: TutorDefinition,
  body: AudioOutRequest,
): Promise<AudioOutResponse> {
  assertCapability(tutor, "voice_out");
  if (typeof body.prompt !== "string" || body.prompt.trim().length === 0) {
    throw new ToolCallError("voice_out: prompt is required", "voice_out", 400);
  }
  if (body.durationMs !== undefined && body.durationMs > 30_000) {
    throw new ToolCallError("voice_out: durationMs must be ≤ 30000", "voice_out", 400);
  }
  return postTool<AudioOutRequest, AudioOutResponse>("/api/ai/tools/audio-out", body, "voice_out");
}

export const __testing = { AI_SVC_URL, INTERNAL_KEY, assertCapability, postTool };
