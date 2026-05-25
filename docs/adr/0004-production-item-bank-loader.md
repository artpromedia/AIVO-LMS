# 0004 — Production item-bank loader + validation gate

- **Status:** Accepted
- **Date:** 2026-05-25
- **Related:** Sprint 3, ADR 0002, ADR 0003

## Context

Sprint 2 (ADR 0003) added four production item-bank seeds totalling 92
items across math / ELA / science / writing K-8. The seeds live in
`packages/item-bank/src/seed-{subject}.ts` and are re-exported from
`packages/item-bank/src/index.ts`.

Callers that need "the production items" (the web BFF seed, the
assessment-svc item loader, a future authoring importer) currently have
to import each seed file by name and concatenate manually. That couples
every caller to the per-subject file layout and gives no safe boundary
between production seeds and the K-2 fixtures in
`packages/item-bank/fixtures/k2-baseline/bank.json` — production code
could accidentally consume fixtures and ship test content.

Sprint 1 (ADR 0002) constrained which surface types the lesson player's
SurfaceRouter can dispatch. Production items must stay within that set,
but there is no automated check today.

## Decision

We add a centralised production loader and a validation gate:

- **`packages/item-bank/src/production.ts`** — single module that owns
  access to the four production seed banks. Exposes:
  - `getAllProductionItems()` — flat `Item[]` across required subjects.
  - `getProductionItemsForSubject(subject)` — per-subject access.
  - `getProductionBankForSubject(subject)` and
    `getCombinedProductionBank()` — `ItemBank` wrappers with a default
    defect budget of 5.
  - `getProductionItemCounts()` — fast threshold sanity check.
  - `RequiredSubjectSlug = "math" | "ela" | "science" | "writing"`.
  Fixtures are intentionally NOT exposed here.

- **`packages/item-bank/src/validate.ts`** — extended:
  - New `ROUTABLE_SURFACE_TYPES` set listing the six runtime surface
    types the lesson player dispatches. Mirrors
    `SUPPORTED_RUNTIME_TYPES` in `learner-surfaces/SurfaceRouter/surface-type-map.ts`;
    a cross-package import would create a cycle, so the parity is
    enforced by tests.
  - New `unrouted_surface_type` issue code emitted by
    `validateItemVariant` when an item picks a non-routable surface.

- **`packages/item-bank/src/__tests__/production-bank.test.ts`** —
  14 new assertions covering: ≥20 items per subject, every item / variant
  is well-formed, every surfaceType is router-supported, ids are
  globally unique, and skillId substrings correctly attribute items to
  their subject.

- **`packages/item-bank/scripts/validate-production.mjs`** + a new
  `item-bank:validate` package script (and a `pnpm item-bank:validate`
  root script) — CI-friendly gate that loads the built bank and runs
  the same checks, reporting pass/fail counts.

## Consequences

- **Positive:**
  - Production callers have one stable import surface; the per-subject
    seed files become an implementation detail.
  - Fixture content cannot leak into production paths.
  - Surface-type drift (an author picking a surface the router doesn't
    support) is caught both at unit-test time and at the repo-level
    `item-bank:validate` gate.
- **Negative:**
  - The runtime surface-type list is duplicated between
    `learner-surfaces` and `item-bank` (with a parity comment in
    `validate.ts`). A cross-package import would close the loop but
    requires either a third "contract" package or a build-order change.
  - The web BFF (`apps/web-v2/lib/db/seed.ts`) does not yet wire the
    production loader into the in-memory store — the BFF lacks an
    `items` table, and adding one is a Drizzle-schema-level change
    that belongs with the assessment-svc integration sprint. Tracked
    as a follow-up.
- **Neutral / follow-ups:**
  - Once the SurfaceRouter routes the remaining authored types
    end-to-end (drag-drop, ink-canvas with strokes, art-canvas with
    save-back), `ROUTABLE_SURFACE_TYPES` will widen and the per-item
    `surfaceType` field union in `types.ts` should widen with it.

## Alternatives Considered

- **Generate the production bank from JSON files in `data/production/`
  via a build step.** Considered, deferred: the authoring pipeline
  (`pnpm item-bank:import`) already does this for fully-shaped
  `AuthoredItem` records. The Sprint 3 surface (TS literal modules) is
  the minimum that satisfies the audit; migrating to JSON is a
  curriculum-content-team task.
- **Put the routability check directly in the lesson player.** Rejected:
  the lesson player would discover bad items at runtime, after they've
  already shipped. The author-time gate is the right place.
