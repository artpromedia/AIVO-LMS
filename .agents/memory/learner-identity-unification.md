---
name: Cross-platform learner identity unification
description: How web-v2 learners map to the canonical identity-svc learner UUID, and the seams that must stay in sync.
---

# Cross-platform learner identity

**Canonical learner identity = identity-svc `learners.id` (a UUID).** The backend
microservices (learning-svc sessions, mobile pin-login, mastery) all key off it.

web-v2 keeps its **own** `lrn_*` primary key and links to the canonical UUID via
`LearnerProfile.identityLearnerId` stored inside the profile's `data` JSONB — NOT a
dedicated column.

**Why:** the web app's domain tables (`web_*`) intentionally store the whole domain
object in a `data` JSONB and only promote columns that stores actually filter on. A
link field fits the JSONB convention and avoids a column migration; a partial unique
index on the link enforces one web profile per canonical learner per tenant.

**How to apply / seams that must stay in sync:**
- **Provision + link** on web enrollment: BFF `POST /api/bff/learners` creates the web
  profile, then POSTs to identity-svc and stores the returned UUID. Best-effort —
  identity-svc enforces its own seat caps, so a failure must NOT break web creation.
- **Two duplicate-creation directions, two guards.** identity→web is guarded by the
  partial unique index + a pre-insert dedupe.
  web→identity has NO such guard at identity-svc, so a partial failure (identity create
  succeeds, web link-write fails) would mint a duplicate canonical learner on the next
  retry/reconcile/PIN-set. Guard: before creating, look for an existing *unlinked*
  identity learner matching by name and reuse it. Matching by name within one parent's
  roster can mis-pair two same-named kids, but that's far cheaper than duplicate
  identities. Reconcile shares one reuse context across its pass (single list read, no
  double-assign); standalone callers pass the parent id to build their own.
- **PIN** must target the identity UUID, not the web `lrn_*` id, or identity-svc 404s.
- **Reconcile is lazy, per-parent, on read** (BFF `GET /api/bff/learners`), not an
  offline backfill script: it backfills web→identity links AND surfaces identity-only
  (mobile-origin) learners as web profiles. Must be idempotent + best-effort.
- **Mastery bridge**: learning-svc session completion carries the identity UUID; the
  web mastery writer must translate UUID→web `lrn_*` id (via
  `data->>'identityLearnerId'`) before writing, or the web dashboards never read it.
  Falls back to the input id when unlinked (web-origin sessions already pass `lrn_*`).
- A learner surfaced from identity without a real DOB gets a placeholder `birthYear`
  the parent corrects later — web `LearnerProfile.birthYear` is required.
