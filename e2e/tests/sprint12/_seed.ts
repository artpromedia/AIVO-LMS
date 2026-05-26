/**
 * Sprint 12.6 — canonical seed helper for Sprint 12 E2E specs.
 *
 * Historically each spec inlined its own `trySeed()` helper that
 * caught seed failures, returned `null`, and let the spec then
 * `test.skip(!seed, ...)`. That pattern silently green-passed the
 * build whenever identity-svc was unreachable / IDENTITY_TEST_MODE was
 * off / the seed endpoint returned a non-200 status — masking real
 * regressions in the seed surface itself.
 *
 * This helper inverts the contract: **any seed failure throws** with
 * a descriptive Error including the role being seeded and the
 * upstream reason. Specs that need a fixture call `seedOrThrow(...)`
 * directly and let Playwright fail the test loud.
 */
import { request as pwRequest } from "@playwright/test";

export interface SeedRequest {
  /** The user-facing role this fixture seeds. Surfaces in the thrown
   * Error message so test failures are immediately actionable. */
  role: string;
  /** Identity-svc base URL (defaults to IDENTITY_BASE_URL or :3001). */
  identityBaseUrl?: string;
  /** Test-mode seed endpoint path (e.g. `/api/__test__/seed-district-admin`). */
  endpoint: string;
  /** JSON body sent to the seed endpoint. */
  body: Record<string, unknown>;
}

export interface SeedResponse<T> {
  data: T;
}

/**
 * Seed a Sprint 12 fixture or throw a descriptive Error.
 *
 * Throws `Sprint12 seed failed for role=<role>: <reason>` on any of:
 *   • network failure reaching identity-svc;
 *   • seed endpoint returning a non-200 status;
 *   • seed endpoint returning a malformed JSON body.
 */
export async function seedOrThrow<T = unknown>(req: SeedRequest): Promise<T> {
  const baseURL = req.identityBaseUrl || process.env.IDENTITY_BASE_URL || "http://localhost:3001";
  let ctx;
  try {
    ctx = await pwRequest.newContext({ baseURL });
  } catch (err: any) {
    throw new Error(
      `Sprint12 seed failed for role=${req.role}: could not open request context against ${baseURL}: ${err?.message ?? err}`,
    );
  }

  let res;
  try {
    res = await ctx.post(req.endpoint, { data: req.body, failOnStatusCode: false });
  } catch (err: any) {
    await ctx.dispose();
    throw new Error(
      `Sprint12 seed failed for role=${req.role}: network error calling ${baseURL}${req.endpoint}: ${err?.message ?? err}`,
    );
  }

  if (res.status() !== 200) {
    let detail = "";
    try {
      detail = await res.text();
    } catch {
      /* ignore */
    }
    await ctx.dispose();
    throw new Error(
      `Sprint12 seed failed for role=${req.role}: ${baseURL}${req.endpoint} returned HTTP ${res.status()}${detail ? ` — ${detail.slice(0, 200)}` : ""}. ` +
        `Verify identity-svc is reachable and IDENTITY_TEST_MODE=1 is set.`,
    );
  }

  let json: T;
  try {
    json = (await res.json()) as T;
  } catch (err: any) {
    await ctx.dispose();
    throw new Error(
      `Sprint12 seed failed for role=${req.role}: ${baseURL}${req.endpoint} returned a non-JSON body: ${err?.message ?? err}`,
    );
  }

  await ctx.dispose();
  return json;
}
