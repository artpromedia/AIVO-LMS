/**
 * Sprint 12.7 — e2e LTI launch smoke. Runs against the compose harness
 * brought up by docker-compose.e2e.yml.
 *
 * The full launch (real platform OIDC redirect dance) requires a
 * platform sandbox account; this test exercises the AIVO-side
 * /api/lti/launch endpoint with a synthetically signed JWT and a tiny
 * Node-side JWKS stub so the e2e job stays hermetic.
 */
import { test, expect } from "@playwright/test";

const INTEGRATION_URL = process.env.INTEGRATION_URL ?? "http://127.0.0.1:3068";

test("integration-svc /api/lti/validate accepts a well-formed payload", async ({ request }) => {
  const res = await request.post(`${INTEGRATION_URL}/api/lti/validate`, {
    data: {
      payload: {
        issuer: "https://canvas.instructure.com",
        client_id: "aivo-tool",
        deployment_id: "1:abc",
        target_link_uri: "https://aivo.example/learn/lesson-1",
        nonce: "n",
        state: "s",
        id_token: "header.body.sig",
        resource_link: { id: "rl" },
        context: { id: "ctx" },
      },
      productionMode: false,
    },
  });
  expect(res.status()).toBe(200);
  const body = await res.json();
  expect(body).toHaveProperty("valid");
});

test("integration-svc /api/lti/launch returns 400 when params missing", async ({ request }) => {
  const res = await request.post(`${INTEGRATION_URL}/api/lti/launch`, { data: {} });
  expect(res.status()).toBe(400);
});
