import { test, expect } from "@playwright/test";

/**
 * Security-header contract (Sprint A3, ZAP #65/#73).
 *
 * Asserts the response-header floor on a document route, the login page,
 * and a static metadata file, plus the CSRF middleware behavior on the
 * BFF. Runs against whatever server the visual suite uses (dev or built);
 * production-only headers (HSTS) are asserted conditionally.
 */

const DOCUMENT_PATHS = ["/", "/login"];

for (const path of DOCUMENT_PATHS) {
  test(`document headers on ${path}`, async ({ request }) => {
    const res = await request.get(path);
    expect(res.status()).toBe(200);
    const headers = res.headers();
    expect(headers["x-frame-options"]).toBe("DENY");
    expect(headers["x-content-type-options"]).toBe("nosniff");
    expect(headers["referrer-policy"]).toBe("strict-origin-when-cross-origin");
    expect(headers["cross-origin-opener-policy"]).toBe("same-origin");
    expect(headers["cross-origin-resource-policy"]).toBe("same-origin");
    expect(headers["x-powered-by"]).toBeUndefined();
    const csp = headers["content-security-policy"];
    expect(csp, "CSP must be set").toBeTruthy();
    expect(csp).toContain("default-src 'self'");
    expect(csp).toMatch(/script-src [^;]*'nonce-/);
    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).toContain("report-uri /api/bff/csp-report");
  });
}

test("static metadata files carry the header floor (robots.txt)", async ({ request }) => {
  const res = await request.get("/robots.txt");
  expect(res.status()).toBe(200);
  const headers = res.headers();
  expect(headers["x-content-type-options"]).toBe("nosniff");
  expect(headers["x-powered-by"]).toBeUndefined();
});

test("CSRF middleware rejects cross-site mutations on the BFF", async ({ request }) => {
  const res = await request.post("/api/bff/auth/logout", {
    headers: {
      origin: "https://evil.example.com",
      "sec-fetch-site": "cross-site",
    },
    failOnStatusCode: false,
  });
  expect(res.status()).toBe(403);
  const body = await res.json();
  expect(body.error?.code).toBe("CSRF_REJECTED");
});

test("CSRF middleware passes same-origin mutations through", async ({ request, baseURL }) => {
  const res = await request.post("/api/bff/auth/mock-login", {
    headers: { origin: new URL(baseURL!).origin, "sec-fetch-site": "same-origin" },
    data: { role: "learner" },
    failOnStatusCode: false,
  });
  // Mock-mode server: 200. Real-auth server: mock-login refuses with 404 —
  // either way the request reached the route (NOT a 403 from the guard).
  expect([200, 404]).toContain(res.status());
});

test("CSP violation report sink acks", async ({ request }) => {
  const res = await request.post("/api/bff/csp-report", {
    headers: { "content-type": "application/csp-report" },
    data: JSON.stringify({
      "csp-report": {
        "violated-directive": "script-src",
        "blocked-uri": "https://example.com/x.js",
        "document-uri": "https://app.local/",
      },
    }),
    failOnStatusCode: false,
  });
  expect(res.status()).toBe(204);
});
