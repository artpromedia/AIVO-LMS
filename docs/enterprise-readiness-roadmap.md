# Enterprise Readiness Roadmap

This document tracks the progression of `artpromedia/aivo-ai-learning` from the
current family-first learner experience to an enterprise-capable platform that
can absorb the legacy AIVO capabilities (problem-session ledger, tutor surface
protocol, math/science recognizers, subject brain, homework helper with OCR,
profile recommendation engine, district enterprise mode, data governance, and
responsible AI guardrails) without disturbing existing flows.

## Guiding Principles

1. Preserve every existing route and payload unless a backward-compatible
   adapter is added.
2. Default every enterprise capability to **off** behind a feature flag.
3. Treat new database tables as **additive**. Reversible migrations only.
4. Wrap legacy flows — never replace them in place.
5. Every mutation to a learner profile must be observable through audit context
   and (once Sprint 09 lands) the audit service.
6. Parent-owned profile fields require parent approval. Teachers may submit
   observations but cannot directly mutate parent-governed fields.

## Sprint Map

| Sprint | Capability                                                     | Flag                                         |
| ------ | -------------------------------------------------------------- | -------------------------------------------- |
| 01     | Foundation: feature flags, enterprise core, compatibility docs | n/a (foundation)                             |
| 02     | Problem session ledger and event collector                     | `problemSessionLedger`                       |
| 03     | Tutor surface protocol and persistent learning surfaces        | `tutorSurfaceProtocol`                       |
| 04     | Math recognizer and science solver services                    | shared with Sprint 03                        |
| 05     | Subject brain layer and advanced content generators            | `advancedContentGenerators`                  |
| 06     | Homework OCR, four-step helper, focus monitor, self-regulation | `selfRegulationHub`                          |
| 07     | Automatic profile recommendation engine with parent approval   | `profileRecommendationsV2`                   |
| 08     | District enterprise mode, RBAC, SIS sync, LTI 1.3              | `districtEnterpriseMode`, `sisSync`, `lti13` |
| 09     | Data governance: audit, DPA, export, deletion, retention       | `dataGovernanceCenter`                       |
| 10     | Responsible AI guardrails, observability, release gates        | `responsibleAiGuardrails`                    |

## Acceptance Gates

Each sprint must satisfy:

- `pnpm install --frozen-lockfile` succeeds.
- `pnpm test`, `pnpm lint`, `pnpm build`, and `pnpm format:check` all pass.
- All enterprise tests pass with flags **off**.
- All enterprise tests pass with flags **on**.
- No placeholder comments, skipped tests, or unimplemented branches.

## Risk Register

- **Backward compatibility**: route adapters must keep current payloads stable.
- **Database additivity**: no destructive migrations. New tables only.
- **PII redaction**: free-form IEP text, parent private notes, and OCR text
  must be redacted before reaching analytics or audit metadata.
- **Role escalation**: only parents can approve profile mutations; tests in
  `@aivo/enterprise-core` lock this behavior.
