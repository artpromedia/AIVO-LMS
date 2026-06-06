# Curriculum architecture — target end state

> Decision record: [ADR 0040 — Curriculum source of truth](../adr/0040-curriculum-source-of-truth.md)
> and [ADR 0041 — Agentic boundaries](../adr/0041-agentic-boundaries.md).
> This document describes where the curriculum subsystem is headed after
> Sprints 1–8. Items not yet implemented are marked **(planned: Sprint N)**.

## The one rule

`curriculum-svc` is the **sole authoritative source** of curriculum
truth. Every standard code a learner is held to exists in its catalogue.
LLM-driven services (`brain-svc`, `ai-svc`) may only personalize and
scaffold catalogue nodes — never invent standards.

## Resolution chain

A learner's curriculum is resolved deterministically, left to right:

```
 Jurisdiction        Framework            Content pack         Skill                Scaffolded lesson
 ───────────         ─────────            ────────────         ─────                ─────────────────
 {country,           authoritative        curated pack of      atomic standard      LLM rephrases /
  region,      ───►  standards     ───►   skills for a    ───► node with a     ───► sequences / themes
  district?,         framework for        (jurisdiction,       canonical code       the VALIDATED node
  postalCode?}       that jurisdiction    subject, grade)      + prerequisites      for the learner

 owned by            frameworks.py        packages/            packages/            brain-svc
 jurisdiction.py     (single registry,    content-pack/        skill-graphs/        curriculum_engine.py
 (S2, done)          S2 done)             (intl: S3)           (US today; intl S3)  (scaffold-only, S3)
        │                                                                                  │
        │                                                                                  ▼
        │                                                                          curriculum_validator.py
        │                                                                          rejects any code not in
        │                                                                          the catalogue (S3, ADR 0041)
        ▼
 US: ZIP → district (today, catalogue.py / _ZIP5_RE)
 NG/AE/GB: country (+region) → framework → packs (planned: S2/S3)
 Unknown country: 404 "no curriculum seeded" — never a US/CCSS fallback
```

## Components and their roles

| Component | Role | Status |
| --------- | ---- | ------ |
| `services/curriculum-svc` | **Authoritative** catalogue: skills, prerequisites, content packs, frameworks, jurisdiction resolution, validation. | US ZIP catalogue today; intl + auth + authoring + validate over Sprints 1–7. |
| `curriculum-svc/.../catalogue.py` | In-memory read model loaded from the `skill_graphs.json` snapshot; enforces district/jurisdiction scoping; `resolve_jurisdiction()`. | Generalized to the `Jurisdiction` model (S2). |
| `curriculum-svc/.../jurisdiction.py` + `frameworks.py` | `{country, region, district, postalCode}` → framework resolution; single framework registry (NERDC/MOE/NC/…). | Done (S2). Intl content seeded S3. |
| `curriculum-svc/.../auth.py` | Service-token / JWT auth for catalogue access. | Weak bearer check today; real RS256 in S1. |
| `packages/content-pack/data/<jurisdiction>/catalogue.json` | Curated source data per jurisdiction (US-CCSS + NG-NERDC, AE-MOE, GB-NC), each skill citing its source. Compiled into the snapshot. | NG/AE/GB seeded (S3). |
| `curriculum-svc/scripts/build_snapshot.py` | Deterministic compiler: source catalogues → `skill_graphs.json`. `--check` fails CI on drift. | Done (S3); replaces the hand-maintained snapshot. |
| `brain-svc/.../curriculum_engine.py` | **Scaffolding only** — rephrases/sequences validated catalogue nodes; prompt forbids inventing codes. | Routed through the validator (S3). |
| `brain-svc/.../curriculum_validator.py` | Enforces ADR 0041: drops any LLM-proposed code absent from the catalogue; emits nothing if the catalogue is unreachable. | Done (S3). |
| `ai-svc/.../curriculum_client.py` | Grounds baseline/LLM output against curriculum-svc; jurisdiction-aware (US ZIP + NG/AE/GB). | Grounding **on by default** (S3). |
| `identity-svc/.../curriculum-lookup.ts` | `resolveJurisdictionViaCurriculumSvc()` calls the authoritative service; static maps are the warm-start cache. | Pointed at curriculum-svc (S3). |

## Authority model (who decides what)

- **curriculum-svc** decides *what standards exist* (deterministic).
- **brain-svc / ai-svc** decide *how to present* an existing standard to
  a specific learner (personalization), bounded by the validator.
- **parents** retain approval authority over learner-state changes
  (unchanged; see family-svc, Sprint 5).
- **teachers / caregivers** may *propose* adjustments; they do not mutate
  brain state directly (Sprint 5).

## What this ends (gaps closed)

- **G0 / G9** — one curriculum engine, one registry; no dual source of
  truth (ADR 0040).
- **G3** — non-US learners resolve to their own jurisdiction, never a
  silent US/CCSS fallback (Sprints 2–3).
- **G4 / agentic safety** — grounding on by default; hallucinated codes
  rejected (ADR 0041, Sprint 3).
