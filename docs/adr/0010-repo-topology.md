# 0010 — Repo topology: canonical surface map

- **Status:** Accepted
- **Date:** 2026-05-27
- **Deciders:** platform team
- **Related:** AIVO-LMS audit gap #15 ("legacy parity risk from repo
  topology mismatch"), `docs/TOPOLOGY.md`

## Context

External readers (and at least one third-party audit) expected a repo
layout with `apps/parent-portal`, `apps/learner-app`, and `apps/api`
as separate top-level applications, and a Flutter mobile app under
`apps/mobile`. None of these exist in the actual tree:

- The parent UI, learner UI, teacher UI, caregiver UI, therapist UI,
  and admin UI **all live in one Next.js app**: `apps/web-v2`. Role
  separation is done by route prefix + middleware, not by separate
  apps.
- The app API is not a separate module — see ADR 0008, the BFF inside
  `apps/web-v2/app/api/bff/**` is the canonical API.
- `apps/mobile` is **Expo / React Native**, not Flutter. There is no
  Dart code in the tree.

This mismatch causes recurring confusion in code reviews, audits, and
new-engineer onboarding ("where is the parent portal?").

## Decision

We will not rename or restructure the existing directories. Instead
we will publish a canonical `docs/TOPOLOGY.md` that documents the
actual layout, and link to it from:

- the top-level `README.md`,
- `CONTRIBUTING.md`,
- the architecture-overview doc.

The TOPOLOGY doc is the source of truth. Any future ADR that changes
the layout updates the doc in the same commit.

We will additionally add **path redirects** at the Next.js level
from the most common "expected" URLs to the real ones:

- `/parent-portal/*` → `/parent/*`
- `/learner-app/*` → `/learner/*`

So that documentation written against the expected naming still
resolves. The redirects are 301 (permanent) so the canonical URL is
indexed.

## Consequences

- **Positive:**
  - Single doc to point at when the question comes up.
  - No directory-level churn; nothing breaks.
  - Common mis-typed URLs resolve to the right place.
- **Negative:**
  - The doc adds maintenance: if a new role app is added, the doc
    has to be updated.
- **Neutral / follow-ups:**
  - If we ever split a role into its own deployable (e.g. a separate
    admin console), this ADR is the moment to revisit the
    one-app-per-role question. We accept the current one-app reality
    until the operational pain points justify the cost of a split.

## Alternatives Considered

- **Rename directories to match the expectation.** Rejected —
  high-churn, no benefit beyond cosmetic.
- **Document only, no redirects.** Rejected — doesn't help the
  copy-pasted-URL case which is where the confusion shows up first.
- **Add empty `apps/parent-portal/README.md` stubs pointing at the
  real location.** Rejected — clutter, and only helps people
  browsing the tree directly.
