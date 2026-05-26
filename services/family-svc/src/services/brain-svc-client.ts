/**
 * Brain-svc client (Sprint 12.5).
 *
 * Thin fetch wrapper around the /api/brain endpoints we need from
 * family-svc. Returns null on transport/5xx failure so callers can fall
 * back to a safe default — never throws into request handlers.
 *
 * Env:
 *   BRAIN_SVC_URL          - base URL, defaults to http://localhost:3008
 *   FAMILY_INTERNAL_KEY    - shared secret echoed on every internal call
 *                            (matches the existing internal-call convention
 *                            in collaboration.ts / recommendations.ts).
 */

const BRAIN_SVC_URL = (process.env.BRAIN_SVC_URL ?? "http://localhost:3008").replace(/\/$/, "");
const INTERNAL_KEY =
  process.env.FAMILY_INTERNAL_KEY ??
  process.env.INTERNAL_SERVICE_KEY ??
  (process.env.NODE_ENV === "production" ? "" : "aivo-internal-dev-key");

export interface AacBoardItem {
  symbol_id: string;
  label: string;
  image_url: string;
  category: string;
  frequency_rank: number;
}

export interface AacBoardResponse {
  items: AacBoardItem[];
  source_domains?: string[];
}

/**
 * Fetch the learner's AAC board from brain-svc. Returns `null` on any
 * network/5xx failure or 4xx that isn't a clean 404; the caller is
 * expected to fall back to a default board so the UI never goes empty.
 */
export async function fetchAacBoard(
  learnerId: string,
  options: { bearerToken?: string; signal?: AbortSignal; timeoutMs?: number } = {},
): Promise<AacBoardResponse | null> {
  const url = `${BRAIN_SVC_URL}/api/brain/aac-board/${encodeURIComponent(learnerId)}`;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), options.timeoutMs ?? 3_000);
  const signal = options.signal ?? controller.signal;

  try {
    const headers: Record<string, string> = {
      "content-type": "application/json",
      "x-internal-key": INTERNAL_KEY,
    };
    if (options.bearerToken) {
      headers.authorization = `Bearer ${options.bearerToken}`;
    }
    const res = await fetch(url, { method: "GET", headers, signal });
    if (!res.ok) {
      // 404 == learner has no brain state yet; both are signals to fall
      // back to the default core board, neither warrants a retry.
      return null;
    }
    const body = (await res.json()) as AacBoardResponse;
    if (!body || !Array.isArray(body.items)) return null;
    return body;
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}
