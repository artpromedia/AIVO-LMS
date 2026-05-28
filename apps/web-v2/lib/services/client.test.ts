/**
 * Service-client smoke tests.
 *
 * Confirms `callService` returns the right result envelope on the
 * happy path, on 4xx/5xx, on timeout, and on network failure. The
 * client itself never throws — the tests assert that property.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { callService } from "./client";

describe("services/client.callService", () => {
  let originalFetch: typeof globalThis.fetch;
  beforeEach(() => {
    originalFetch = globalThis.fetch;
  });
  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.useRealTimers();
  });

  it("returns ok=true with parsed JSON on 2xx", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      async json() {
        return { hello: "world" };
      },
      async text() {
        return "";
      },
    }) as unknown as typeof fetch;
    const result = await callService<{ hello: string }>({
      service: "test-svc",
      baseUrl: "http://example.test",
      url: "/api/hello",
      retries: 0,
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.hello).toBe("world");
      expect(result.attempts).toBe(1);
    }
  });

  it("returns ok=false reason=non_2xx on 4xx without retry", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 404,
      async text() {
        return "not found";
      },
      async json() {
        return {};
      },
    });
    globalThis.fetch = fetchMock as unknown as typeof fetch;
    const result = await callService({
      service: "test-svc",
      baseUrl: "http://example.test",
      url: "/missing",
      retries: 3,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe("non_2xx");
      expect(result.status).toBe(404);
    }
    // 4xx is not retryable.
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("retries on 5xx then surfaces the final failure", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 503,
      async text() {
        return "down";
      },
      async json() {
        return {};
      },
    });
    globalThis.fetch = fetchMock as unknown as typeof fetch;
    const result = await callService({
      service: "test-svc",
      baseUrl: "http://example.test",
      url: "/flaky",
      retries: 2,
    });
    expect(result.ok).toBe(false);
    expect(fetchMock).toHaveBeenCalledTimes(3); // 1 + 2 retries
  });

  it("returns reason=timeout when the upstream aborts", async () => {
    globalThis.fetch = vi.fn().mockImplementation(() => {
      const e = new Error("aborted");
      e.name = "AbortError";
      return Promise.reject(e);
    }) as unknown as typeof fetch;
    const result = await callService({
      service: "test-svc",
      baseUrl: "http://example.test",
      url: "/slow",
      retries: 0,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe("timeout");
  });

  it("returns reason=no_url when neither baseUrl nor absolute url is given", async () => {
    const result = await callService({
      service: "test-svc",
      url: "/missing",
      retries: 0,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe("no_url");
  });
});
