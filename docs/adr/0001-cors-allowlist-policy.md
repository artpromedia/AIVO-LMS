# 0001 — CORS allow-list & fail-closed policy

- **Status:** Accepted
- **Date:** 2026-05-07
- **Deciders:** Platform Engineering
- **Related:** Phase 1 enterprise readiness remediation; `services/brain-svc/src/brain_svc/main.py`, `services/ai-svc/src/ai_svc/main.py`, `services/curriculum-svc/src/curriculum_svc/main.py`

## Context

The three FastAPI services in this repository — `brain-svc`, `ai-svc`,
and `curriculum-svc` — historically registered Starlette's
`CORSMiddleware` with `allow_origins=["*"]` and `allow_credentials=True`.
This combination is rejected by modern browsers, but more importantly
it signals that any origin can issue cross-site requests against these
services. The services in question handle:

- learner brain-clone snapshots and PII-adjacent data (`brain-svc`);
- LLM gateway traffic, including prompt + completion logs (`ai-svc`);
- curriculum lookups that are otherwise read-only but still proxy
  upstream LLM calls (`curriculum-svc`).

We need a policy that (a) is explicit per environment, (b) does not
silently fall back to permissive defaults in production, and (c) is
uniform across services so reviewers know what to expect when they see
`CORSMiddleware` registered.

## Decision

Each Python service computes its CORS allow-list from a
`CORS_ORIGINS` environment variable (comma-separated origins). The
behaviour is:

1. If `CORS_ORIGINS` is set, the parsed list is used verbatim.
2. Otherwise, if `NODE_ENV=production` or `ENV=production`, the list is
   **empty** — the service fails closed and rejects all cross-origin
   requests.
3. Otherwise (local development), a curated list of `localhost` /
   `127.0.0.1` ports used by `apps/web`, `apps/marketing`, and the
   internal admin tools is returned.

`allow_credentials=True` is retained because the services receive
authenticated, cookie- and bearer-token-bearing requests from the web
apps; the wildcard origin that previously made this combination invalid
is no longer used.

The Node/Fastify services are out of scope for this ADR — they enforce
CORS via their own middleware and follow the same allow-list pattern
already.

## Consequences

**Positive**

- No service can ship to production with permissive cross-origin
  defaults; misconfiguration becomes a hard failure rather than a silent
  data-exfiltration vector.
- Local development is unchanged: `pnpm dev` and the documented
  `localhost:3000`/`5173`/`5000` ports continue to work without setting
  any environment variable.
- Behaviour is uniform across the three Python services, so reviewers
  only need to learn one pattern.

**Negative**

- Operators must set `CORS_ORIGINS` for every production deployment.
  Forgetting it produces a working service that rejects all browser
  traffic — loud, but a real outage. We mitigate this in the Helm
  charts by documenting `CORS_ORIGINS` as a required value.
- The development allow-list is duplicated across three `main.py`
  files. We accept this tactically; if a fourth Python service is
  added, the helper should be extracted into a shared module under
  `packages/` or a per-repo `aivo_common` Python package.

**Neutral / follow-ups**

- Consider also restricting `allow_methods` and `allow_headers` to an
  explicit list (today they are still wildcards). Tracked separately.
- Node services should be audited to confirm they follow the same
  fail-closed-in-production rule.

## Alternatives Considered

- **Keep wildcard CORS and rely on auth alone.** Rejected because it
  removes one independent layer of defence and because some endpoints
  rely on cookie-based session auth where CORS is the primary CSRF
  control.
- **Hard-code allowed origins in the source.** Rejected because the
  list differs per environment (staging vs production vs PR previews)
  and would require a code change for every new tenant subdomain.
- **Move all CORS handling to the ingress / API gateway.** Attractive
  long-term but out of scope: today services are exposed via multiple
  ingress paths (Helm + local docker-compose) and we want the same
  default to apply everywhere, including local development.
