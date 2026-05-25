# File-Level Drift Sweep — AIVO_LMS vs aivo-ai-learning (Sprint B)

**Status:** Sprint B baseline (completion plan, follows Sprint A).
**New repository:** `artpromedia/aivo-lms` (this repo, branch `claude/vibrant-gates-33OMX`).
**Legacy reference repository:** `artpromedia/aivo-ai-learning` (read-only).
**Generated:** Sprint B of the AIVO_LMS completion plan.

This document closes the missing "Sprint 02" deliverable referenced
in `docs/migration/aivo-lms-vs-legacy-delta.md`: a file-level diff of
the shared service and package implementations against the legacy
repo, plus a per-target decision (`port`, `keep`, `rewrite`).

The companion `scripts/legacy-drift-check.mjs` validates the
structural manifest at CI time so the inventory below stays honest as
the codebase moves.

## Method

The two repositories were compared at three levels:

1. **Workspace level** (already covered by
   `docs/migration/aivo-lms-vs-legacy-delta.md`) — same 27 services,
   same 31 packages, same root build system.
2. **Module level** (this document) — file listings and primary
   exports of each shared service/package.
3. **Behavior level** (still open) — observable response shapes from
   a running legacy instance. This requires a sandbox deploy of the
   legacy repo and is deferred to its specific port sprint.

Two duplicate-package questions raised in the Sprint 00 delta are
resolved below in **Duplicate resolution**.

## Duplicate resolution

### `packages/ops-alert` vs `packages/ops-alerts`

**Decision: keep both, current state is intentional. Delete
`@aivo/ops-alert` after Sprint G ports the responsible-AI evaluators
that still consume the legacy `send({severity,title,body,dedupKey,fields})`
shape.**

Evidence: `packages/ops-alert/src/index.ts:1-13` already carries an
explicit `@deprecated Sprint 7 — @aivo/ops-alert. (Task #69)` header
that points callers at `@aivo/ops-alerts` and supplies a
`LegacyOpsAlertClient` wrapper for the old shape. The migration is
already in progress; the deprecation comment is the source of truth.

Action: no change in Sprint B. Track removal under Sprint G (Task #69 follow-up).

### `services/integration-svc` vs `services/integrations-svc`

**Decision: keep both. They are not duplicates — they own
non-overlapping domains. Rename in a future infra sprint to remove
the confusion.**

| Service | Domain | Files |
|---|---|---|
| `integration-svc` | SIS rostering (Clever, ClassLink) + LTI 1.3 launch validation | `services/integration-svc/src/services/{clever-adapter,classlink-adapter,sis-provider-interface,lti13-launch-validator}.ts`; routes `sis.ts`, `lti.ts` |
| `integrations-svc` | General third-party connector OAuth, sync logs, roster mappings | `services/integrations-svc/src/routes/connectors.ts`; consumes `integrationConnections`, `integrationSyncLogs`, `integrationRosterMappings` from `@aivo/db` |

Action for Sprint B: document only. Recommended rename for a future
infra sprint:
- `integration-svc` → `sis-lti-svc`
- `integrations-svc` → `connectors-svc`

The rename touches deployment manifests, env vars, and the API
client; it is not in Sprint B scope.

## Per-target drift map (port / keep / rewrite)

The table below lists every shared service or package that is a known
or suspected drift source. Each row carries the disposition decision
and the sprint that owns the work.

Legend:
- **port** — legacy implementation is more complete; bring it into
  this repo behind the named feature flag.
- **keep** — AIVO_LMS implementation is at parity or ahead. No
  action.
- **rewrite** — both repos are incomplete or fundamentally drifted;
  build new.
- **unknown** — needs the file-level diff promised by Sprint B's
  read-only checkout of the legacy repo. Listed here for tracking;
  ports happen in the named sprint.

### Services

| Service | Disposition | Sprint | Feature flag | Test gate |
|---|---|---|---|---|
| `ai-svc` | port (`advanced_content_generators`) | C/D | `advancedContentGenerators` | `test_advanced_math_generator.py`, `test_advanced_science_generator.py` |
| `brain-svc` | keep | — | — | existing brain-svc test suite |
| `subject-brain-svc` | port partial; rewrite missing 7 brains | D | `advancedContentGenerators` | `math-subject-brain.test.ts`, `science-subject-brain.test.ts` (new: coding, speech, music, pe-health, world-langs, stem-eng, creative-arts) |
| `tutor-svc` | port (content packs); current modes are `scaffold` only | E | `tutorSurfaceProtocol` | `validators.test.ts`, new `tutor-<subject>-happy-path.spec.ts` |
| `math-recognizer-svc` | port | C | `advancedContentGenerators` | `expression-parser.test.ts`, `geometry-work-analyzer.test.ts` |
| `science-solver-svc` | port | C | `advancedContentGenerators` | `science-reasoning-analyzer.test.ts`, `classification-analyzer.test.ts` |
| `speech-eval-svc` | rewrite (add real ASR provider) | F | — | new `voice-response-real-asr.spec.ts` |
| `problem-session-svc` | port | (already done per `docs/legacy-feature-porting-map.md`) | `problemSessionLedger` | `problem-session-store.test.ts`, `problem-session-routes.test.ts` |
| `homework-svc` | port (focus-monitor, self-regulation-recommender, OCR) | F | `selfRegulationHub` | `homework-step-engine.test.ts`, `focus-monitor.test.ts`, `homework-profile-adapter.test.ts` |
| `recommendation-svc` | port (effect handlers) | G | `profileRecommendationsV2` | `recommendation-effect-handlers.test.ts`, `recommendation-policy.test.ts` |
| `responsible-ai-svc` | port (prompt-injection detector, profile-adherence evaluator) | G | `responsibleAiGuardrails` | `prompt-injection-detector.test.ts`, `profile-adherence-evaluator.test.ts` |
| `data-governance-svc` | port (export-builder, deletion-workflow) | G | `dataGovernanceCenter` | `export-builder.test.ts`, `deletion-workflow.test.ts` |
| `audit-svc` | keep | — | — | existing audit suite |
| `identity-svc` | keep (Sprint A landed the NCES zip→district resolver here) | — | — | existing identity-svc suite + new `zip-district-resolver.test.ts`, `zip-lookup-fallback.test.ts` |
| `integration-svc` | port (Clever / ClassLink read-only, LTI 1.3) | H | `sisSync`, `lti13` | `sis-provider-interface.test.ts`, `lti13-launch-validator.test.ts` |
| `integrations-svc` | unknown — needs file-level diff | future | — | — |
| `tenant-svc` | unknown | future | — | — |
| `admin-svc` | unknown | future | — | — |
| `assessment-svc` | unknown | future | — | — |
| `billing-svc` | keep | — | — | existing billing suite |
| `comms-svc` | unknown | future | — | — |
| `curriculum-svc` | keep | — | — | existing curriculum suite |
| `engagement-svc` | unknown | future | — | — |
| `family-svc` | unknown | future | — | — |
| `i18n-svc` | keep | — | — | existing i18n suite |
| `learning-svc` | keep (already gates subject-brain enrichment behind `advancedContentGenerators`) | — | — | `sessions.degraded.test.ts` |
| `research-svc` | keep | — | — | — |
| `status-page-svc` | keep | — | — | — |
| `alerts-proxy-svc` | keep (paired with `@aivo/ops-alerts`) | — | — | — |

### Packages

| Package | Disposition | Sprint | Notes |
|---|---|---|---|
| `aac-bridge` | rewrite (finish CoughDrop adapter end-to-end) | F | Currently device-integration scaffolds; needs one device path tested |
| `adaptive-baseline` | unknown | future | — |
| `api-client` | keep (auto-generated; runs through `pnpm api:check`) | — | — |
| `billing-entitlements` | keep | — | Drives Sprint 11 of original plan |
| `brand` | keep | — | Token source-of-truth |
| `content-pack` | port (real content for tutors) | E | Replaces `defaultContentPackRefs: ["…-fall-2026"]` placeholders |
| `curriculum-authoring` | unknown | future | — |
| `db` | keep (Sprint A added `districts` + `zip_district` tables) | — | — |
| `enterprise-core` | keep | — | — |
| `events` | keep | — | — |
| `executive-function` | rewrite (implement against subject-brain-svc EF brain) | F | Currently one test file |
| `feature-flags` | keep | — | — |
| `item-bank` | unknown | future | — |
| `learner-surfaces` | port (drop `degraded:true` from VoiceResponseSurface) | F | — |
| `learner-ui` | keep | — | — |
| `level-transforms` | keep | — | — |
| `mobile-ui` | keep | — | — |
| `nav` | keep | — | — |
| `observability` | keep | — | — |
| `ops-alert` | deprecated — delete after Sprint G | G | See Duplicate resolution above |
| `ops-alerts` | keep | — | — |
| `pedagogy` | unknown | future | — |
| `scheduling` | keep | — | — |
| `scoring` | unknown | future | — |
| `security` | keep | — | — |
| `skill-graphs` | port (real CCSS/NGSS subgraphs beyond `ccss-math-k` stub) | E | — |
| `special-interest-engine` | unknown | future | — |
| `sso` | keep | — | — |
| `stage-runtime` | keep | — | — |
| `stage-ui` | keep | — | — |
| `tutor-runtime` | keep | — | — |
| `tutor-sdk` | keep | — | — |
| `tutor-surface-protocol` | port (validators) | E | `validators.test.ts` |

## Drift CI

`scripts/legacy-drift-check.mjs` validates the expected workspace
manifest against the actual file system. Add new services or packages
to the manifest in the same PR that adds them; the check is wired as
`pnpm legacy:drift` and intended to run in CI.

The script does not call out to GitHub — it operates entirely on the
local checkout. Cross-repo behavioral diffs are owned by each port
sprint (e.g. Sprint C tests legacy `math-recognizer-svc` responses
against the new implementation before flipping the feature flag).

## What's still missing (the hard part)

The above is a structural and feature-flag-level drift map. It does
NOT yet include:

1. **Per-file behavior diffs** — e.g. whether the legacy
   `tutor-svc/src/lib/aiSvc.ts` posts the same request body shape as
   the current one. Done per-port-sprint with a recorded request
   transcript.
2. **Database schema drift** — both repos use `@aivo/db`; the schema
   files match by name but the migrations 0033–0036 are not in the
   journal (`packages/db/drizzle/meta/_journal.json`) and are likely
   applied manually in legacy. Sprint A fixed the journal for 0037;
   bringing 0033–0036 into the journal is a separate small PR.
3. **Generated-code drift** — `packages/api-client` is regenerated
   from OpenAPI. Verify on each port that `pnpm api:check` still
   passes; do not edit the generated client by hand.

These three remain TODOs and are tracked as follow-ups to Sprint B.
