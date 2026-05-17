# Legacy Feature Porting Map

This document maps capabilities from the legacy AIVO repositories onto the
current `aivo-ai-learning` architecture. Each row identifies where the
capability will live, which feature flag controls it, the migration risk, and
the test gate that must pass before the flag can be enabled in production.

## Format

```text
Legacy capability -> Current target module -> Feature flag -> Migration risk -> Test gate
```

## Mapping

| Legacy capability             | Current target module                                             | Feature flag                | Migration risk                                                            | Test gate                                                                  |
| ----------------------------- | ----------------------------------------------------------------- | --------------------------- | ------------------------------------------------------------------------- | -------------------------------------------------------------------------- |
| `problem-session-svc`         | `services/problem-session-svc` (Sprint 02)                        | `problemSessionLedger`      | Additive tables; adapters only run when flag is on                        | `problem-session-store.test.ts`, `problem-session-routes.test.ts`          |
| `math-recognizer-svc`         | `services/math-recognizer-svc` (Sprint 04)                        | `advancedContentGenerators` | Deterministic rule-based recognizer first; ML provider behind interface   | `expression-parser.test.ts`, `geometry-work-analyzer.test.ts`              |
| `science-solver-svc`          | `services/science-solver-svc` (Sprint 04)                         | `advancedContentGenerators` | Rule-based reasoning analyzer first                                       | `science-reasoning-analyzer.test.ts`, `classification-analyzer.test.ts`    |
| `subject-brain-svc`           | `services/subject-brain-svc` (Sprint 05)                          | `advancedContentGenerators` | Generator falls back to current pipeline when flag is off                 | `math-subject-brain.test.ts`, `science-subject-brain.test.ts`              |
| `responsible-ai-svc`          | `services/responsible-ai-svc` (Sprint 10)                         | `responsibleAiGuardrails`   | Evaluates AI output before display; can `warn` or `block`                 | `prompt-injection-detector.test.ts`, `profile-adherence-evaluator.test.ts` |
| `data-governance-svc`         | `services/data-governance-svc` + `services/audit-svc` (Sprint 09) | `dataGovernanceCenter`      | Retention holds must block deletion; redact private fields                | `export-builder.test.ts`, `deletion-workflow.test.ts`                      |
| District portal               | `apps/web/src/app/dashboard/district/*` (Sprint 08)               | `districtEnterpriseMode`    | Family-only learners must still work without district tenant              | `tenant-policy.test.ts`, web district tests                                |
| SIS sync (Clever / ClassLink) | `services/integration-svc` (Sprint 08)                            | `sisSync`                   | Must not overwrite parent-owned profile fields                            | `sis-provider-interface.test.ts`                                           |
| LTI 1.3                       | `services/integration-svc` (Sprint 08)                            | `lti13`                     | Unsigned tokens rejected in production mode                               | `lti13-launch-validator.test.ts`                                           |
| Parent profile approval gates | `services/recommendation-svc` + parent dashboard (Sprint 07)      | `profileRecommendationsV2`  | Effects emit audit + Brain snapshot; teachers cannot approve              | `recommendation-effect-handlers.test.ts`, `recommendation-policy.test.ts`  |
| Homework OCR                  | `services/homework-svc` + `services/ai-svc` vision (Sprint 06)    | `selfRegulationHub`         | OCR provider behind interface; deterministic text fallback                | `homework-step-engine.test.ts`                                             |
| Focus monitor                 | `services/homework-svc/focus-monitor` (Sprint 06)                 | `selfRegulationHub`         | Signals only; no autonomous mutation                                      | `focus-monitor.test.ts`                                                    |
| Self-regulation hub           | `services/homework-svc/self-regulation-recommender` (Sprint 06)   | `selfRegulationHub`         | Sensory-profile-aware prompts; no audio without explicit opt-in           | `homework-profile-adapter.test.ts`                                         |
| Advanced content generators   | `services/ai-svc/.../advanced_content_generators` (Sprint 05)     | `advancedContentGenerators` | StagePlan validator must require `subjectBrainEvidenceUsed`               | `test_advanced_math_generator.py`, `test_advanced_science_generator.py`    |
| Tutor surface protocol        | `packages/tutor-surface-protocol` + ai-svc directives (Sprint 03) | `tutorSurfaceProtocol`      | Validators reject raw HTML/SVG; speech-required commands gated by profile | `validators.test.ts`                                                       |
