# `tutor-content-signoffs.json` — schema & tiers

> Remediation Sprint 01. This file defines what a signoff entry in
> `docs/quality/tutor-content-signoffs.json` means and — critically — what a
> signoff can and **cannot** do under the honest coverage gate
> (`pnpm curriculum:coverage`, `scripts/curriculum-coverage-check.mjs`).

## Shape

```jsonc
{
  "signoffs": {
    "<skill-graph-id>": [
      {
        "reviewer": "<who>",
        "role": "<their role>",
        "date": "YYYY-MM-DD",
        "notes": "<context>",
        "tier": "sme_signoff" | "owner_attestation" | "engineering_baseline"
      }
    ]
  }
}
```

## Tiers

| Tier | Meaning | Who may add it |
| --- | --- | --- |
| `sme_signoff` | A credentialed curriculum designer **and** (where the content serves supported/low-verbal/non-verbal learners) a special-education specialist reviewed the graph + mapped items for accuracy, grade fit, and accessibility. | Curriculum team after a documented review |
| `owner_attestation` | The project owner attests the content was human-reviewed. Interim signal only. | Project owner |
| `engineering_baseline` | Inherited from the GREEN-03 engineering seed import — provenance marker, not a content review. | Engineering (historical) |

## What a signoff does NOT do

Since Sprint 01, **no signoff tier — including `sme_signoff` — is sufficient
on its own** to mark a tutor `coverageMatrix` band `"authored"`. The
promotion guard requires **all three**, machine-checked on every run:

1. a band-covering `skillGraphRef` whose file `version` is not a `-draft`,
2. a non-empty signoff entry for that graph (any tier), and
3. **≥ `MIN_AUTHORED_ITEMS_PER_BAND` (3) real production item-bank items at
   that band** for the tutor's declared subjects, counted from the compiled
   `@aivo/item-bank` (`countAuthoredItems`) — never from a manifest and never
   from this file.

`owner_attestation` / `engineering_baseline` entries keep the gate green only
together with the item bar, and every `authored` band resting solely on them
emits a gate **warning** until a real `sme_signoff` lands. Editing this file
can therefore never promote a band that lacks real items — author the items
or mark the band `"scaffold"`.

## Promoting a band, honestly

1. Author ≥3 real production items per band in `packages/item-bank/src/seed-*.ts`
   (or via the import CLI) for the tutor's subject(s).
2. Ensure a non-draft skill graph covers the band and is signed off here.
3. Flip the tutor's `coverageMatrix` cell to `"authored"` and bump
   `docs/quality/tutor-coverage-baseline.json` in the same PR.
4. `pnpm curriculum:coverage` must pass — it is the arbiter, not this ledger.
