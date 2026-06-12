import { afterEach, describe, expect, it, vi } from "vitest";
import { BffError, bffFetch, isNetworkError } from "./client";

const jsonResponse = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("bffFetch", () => {
  it("unwraps ok envelopes to data", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => jsonResponse({ ok: true, data: { value: 7 }, requestId: "r1" })),
    );
    await expect(bffFetch<{ value: number }>("/api/bff/x")).resolves.toEqual({ value: 7 });
  });

  it("throws BffError carrying code/userMessage/retryable on ok:false", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        jsonResponse(
          {
            ok: false,
            error: {
              code: "FORBIDDEN_LEARNER",
              message: "scope mismatch",
              userMessage: "That learner isn't on this account.",
              retryable: false,
            },
            requestId: "r2",
          },
          403,
        ),
      ),
    );
    const err = (await bffFetch("/api/bff/x").catch((e) => e)) as BffError;
    expect(err).toBeInstanceOf(BffError);
    expect(err.code).toBe("FORBIDDEN_LEARNER");
    expect(err.userMessage).toContain("learner");
    expect(err.retryable).toBe(false);
    expect(err.requestId).toBe("r2");
  });

  it("maps transport failures to retryable NETWORK errors", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new TypeError("Failed to fetch");
      }),
    );
    const err = (await bffFetch("/api/bff/x").catch((e) => e)) as BffError;
    expect(isNetworkError(err)).toBe(true);
    expect(err.retryable).toBe(true);
  });

  it("synthesizes an error for non-envelope failures and marks 5xx retryable", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("bad gateway", { status: 502 })));
    const err = (await bffFetch("/api/bff/x").catch((e) => e)) as BffError;
    expect(err).toBeInstanceOf(BffError);
    expect(err.code).toBe("HTTP_502");
    expect(err.retryable).toBe(true);
  });

  it("serializes bodies and idempotency keys", async () => {
    const spy = vi.fn(async () => jsonResponse({ ok: true, data: null, requestId: "r3" }));
    vi.stubGlobal("fetch", spy);
    await bffFetch("/api/bff/x", { method: "POST", body: { a: 1 }, idempotencyKey: "k-1" });
    const [, init] = spy.mock.calls[0] as unknown as [string, RequestInit];
    expect(init.body).toBe(JSON.stringify({ a: 1 }));
    expect((init.headers as Record<string, string>)["idempotency-key"]).toBe("k-1");
    expect((init.headers as Record<string, string>)["content-type"]).toBe("application/json");
  });
});
