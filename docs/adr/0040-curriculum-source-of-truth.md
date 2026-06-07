# 0040 — Curriculum source of truth

- **Status:** Accepted
- **Date:** 2026-06-06
- **Deciders:** @ofemekapongofem (Staff Eng, "Marcus Reeves" persona)
- **Related:** [ADR 0041](./0041-agentic-boundaries.md),
  [docs/curriculum/ARCHITECTURE.md](../curriculum/ARCHITECTURE.md),
  [ADR 0010 — Repo topology](./0010-repo-topology.md)

## Context

Today there are two independent code paths that can produce "the
curriculum standards a learner should follow", and they disagree about
who owns the truth:

1. **`services/curriculum-svc`** — a deterministic, read-only catalogue
   loaded from the bundled `src/curriculum_svc/data/skill_graphs.json`
   snapshot. It resolves a learner to a district (US ZIP → district via
   `catalogue.py`, `_ZIP5_RE`) and serves only the content packs assigned
   to that district. Results are stable and reproducible.

2. **`services/brain-svc/src/brain_svc/services/curriculum_engine.py`**
   — an LLM call (`CURRICULUM_EXTRACTOR_SYSTEM`) that asks a model to
   *"Use REAL standards codes and descriptions from the specified
   framework"* and emit standards JSON (e.g. `CCSS.MATH.3.OA.A.1`,
   `TEKS 3.4A`). Output is non-deterministic and can hallucinate codes
   that do not exist in any framework.

A third location, `services/identity-svc/src/services/curriculum-lookup.ts`,
holds a static map of US state and international framework *names*
(`US_STATE_FRAMEWORKS`, `INTERNATIONAL_FRAMEWORKS` — e.g. `NG-NERDC`,
`UAE-MOE`, `UK-NC`) that is not wired to either engine.

This is gap **G0** (org/source fragmentation) and **G9** (dual curriculum
engines) from the gap-closure sprint plan. The consequence is that a
child's authoritative learning path — the thing IEPs, pacing, and
mastery tracking depend on — can come from a model that invented it.

There is also organisational fragmentation across sibling repositories
(`aivo-pro`, `aivo-agentic-ai-platform`, `aivo-learning*`) that have at
various times carried their own curriculum logic. This ADR records the
canonical decision for **this** monorepo (`artpromedia/AIVO-LMS`).

## Decision

**`services/curriculum-svc` is the single authoritative source of
curriculum truth for the AIVO platform.** Standard codes, skills,
prerequisite chains, content packs, frameworks, and jurisdiction →
framework → pack resolution are owned exclusively by curriculum-svc and
its backing data (`packages/skill-graphs`, `packages/content-pack`,
compiled into the catalogue snapshot).

Specifically:

- **`curriculum-svc` owns authoritative truth.** Every standard code a
  learner is held to must exist in the curriculum-svc catalogue.
- **`brain-svc/curriculum_engine.py` becomes a scaffolding layer.** It
  may *personalize, rephrase, sequence, and scaffold* catalogue nodes
  for a learner's functioning level. It is **forbidden** from inventing
  standard codes. Any code it emits that is not present in the catalogue
  must be rejected (the validation contract is defined in ADR 0041 and
  implemented in Sprint 3 via `brain-svc/.../curriculum_validator.py`).
- **`ai-svc`** grounds LLM output against curriculum-svc and must not be
  the system of record for standards.
- **`identity-svc/curriculum-lookup.ts`** stops being a parallel string
  registry. Its international framework map is migrated into
  curriculum-svc (`frameworks.py`, Sprint 2/3) so there is one registry;
  the US static map remains only as a documented warm-start cache.
- **Sibling repos** (`aivo-pro`, `aivo-agentic-ai-platform`,
  `aivo-learning*`) are **archived / non-canonical** for curriculum. New
  curriculum work lands in `artpromedia/AIVO-LMS` only.

## Consequences

- **Positive:** One place to look for "what is the standard?". A child's
  curriculum becomes deterministic and auditable. Hallucinated standards
  become structurally impossible to serve (rejected at the validator).
  Internationalization has a single home (Sprints 2–3).
- **Negative:** curriculum-svc becomes a hard dependency for brain-svc
  and ai-svc grounding; it must be highly available and its catalogue
  kept current (addressed by the authoring/CMS write path in Sprint 4).
  brain-svc loses the ability to "fill gaps" by generating standards —
  intentional.
- **Neutral / follow-ups:** The catalogue is US-only today; serving
  non-US learners deterministically is Sprint 2 (`Jurisdiction` model)
  and Sprint 3 (real NG/AE/GB content). Live editability is Sprint 4.

## Sprint roadmap — exact files each sprint will touch

This ADR is the contract Sprints 1–8 implement. Migration numbers below
are corrected to the repo's **current max (`0066`)** — the sprint plan's
original `0047/0048/0049` are stale and become `0067/0068/0069`.

| Sprint | Theme | Primary files |
| ------ | ----- | ------------- |
| 1 | curriculum-svc auth hardening | `curriculum-svc/.../jwt_verifier.py` (new), `.../auth.py`, `.../tests/test_auth.py` (new), `requirements.txt`, `README.md`, `.env.example` |
| 2 | `Jurisdiction` model | `curriculum-svc/.../jurisdiction.py`, `.../frameworks.py`, `.../routes/jurisdictions.py`, `.../tests/test_jurisdiction.py` (new); edit `.../catalogue.py`, `.../routes/lookup.py`, `.../data/skill_graphs.json`, `main.py` |
| 3 | Real NG/AE/GB content + grounding default-on | `packages/content-pack/data/{ng-nerdc,ae-moe,gb-nc}/` (new), `packages/skill-graphs/src/intl/` (new), `curriculum-svc/scripts/build_snapshot.py` (new), `brain-svc/.../curriculum_validator.py` (new); edit `ai-svc/.../curriculum_client.py`, `brain-svc/.../curriculum_engine.py`, `identity-svc/.../curriculum-lookup.ts` |
| 4 | Authoring/CMS write path | `curriculum-svc/.../routes/authoring.py` (new), `.../store.py` (new), `packages/db/src/schema/curriculum.ts` (new), `packages/db/drizzle/0067_curriculum_catalogue.sql` (new); edit `catalogue.py`, `main.py` |
| 5 | Caregiver feedback loop | `recommendation-svc/.../observation-signal-transformer.ts` (new), `family-svc/.../routes/suggestions.ts` (new), `packages/events/` (new event types); edit recommendation-generator/evidence-builder/types, family-svc observations/recommendations |
| 6 | Term/trimester syllabus | `ai-svc/.../term_syllabus_parser.py` (new), `.../routes/term_syllabus.py` (new), `packages/db/src/schema/term_syllabus.ts` + `packages/db/drizzle/0068_term_syllabus.sql` (new), web-v2 BFF + UI; edit `brain-svc/.../pacing_engine.py`, `.../routes/pacing.py` |
| 7 | Syllabus ↔ jurisdiction validation | `curriculum-svc/.../routes/validate.py` (new), `.../tests/test_validate.py` (new), web-v2 validation BFF/UI, `packages/db/drizzle/0069_syllabus_validation.sql` (new) |
| 8 | E2E, observability, load | `e2e/tests/{intl-curriculum,caregiver-feedback,term-syllabus}.spec.ts` (new), load test, `docs/curriculum/PROMISES_TRACEABILITY.md` (new); edit both LLM gateways (dedupe preferred-model retry) |

## Alternatives Considered

- **Option A — Keep both engines, reconcile at read time.** Rejected:
  reconciling a deterministic catalogue against per-request LLM output is
  non-deterministic by construction and cannot guarantee a hallucinated
  code is never served.
- **Option B — Make brain-svc authoritative, treat the catalogue as a
  cache.** Rejected: makes a child's curriculum depend on an LLM, which
  violates the platform's determinism requirement for anything a
  curriculum depends on (see ADR 0041).
- **Option C — Put the registry in identity-svc.** Rejected: identity-svc
  owns identity, not pedagogy; its framework map is strings-only and has
  no skill graph, prerequisites, or content packs.
