# Enterprise Release Gates

Release gates are the integration tests under `tests/integration/` that
verify the enterprise contracts every sprint depends on. They are the
last line of defense before an enterprise flag is enabled in
production.

## Tests

| File                              | Pinned contract                                                                                                                                     |
| --------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| `enterprise-readiness.test.ts`    | Feature flags default off; teachers cannot approve recommendations; district admins cannot read parent private notes; teachers cannot mutate Brain. |
| `tutor-profile-adherence.test.ts` | Tutor surface commands are rejected for NON_VERBAL speech-required, LOW_VERBAL long text, geometry-without-shapes, and missing alt text.            |
| `homework-integrity.test.ts`      | Homework step engine blocks final answer until SOLVE; responsible-AI evaluator blocks "the answer is X" output.                                     |

## Running

```bash
pnpm test:integration
```

The script is wired in `package.json` and resolves to:

```bash
vitest run --config tests/integration/vitest.config.ts
```

The enterprise gates are pure-logic tests that depend on workspace
packages. They do not require docker or live HTTP services, so they
fail fast when a contract is broken.

## Gate Failures

A gate failure means:

- A parent governance rule is broken.
- A learner-profile adaptation is bypassed.
- A homework safety guard is bypassed.
- The responsible-AI evaluator misses a fixture it must catch.

Do not work around a gate failure. Fix the underlying rule.
