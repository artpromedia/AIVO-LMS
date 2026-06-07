# Whole-term / trimester syllabus ingestion (Sprint 6, G7)

A parent or teacher can upload an entire term/trimester syllabus per
subject (not just one week). It is parsed into an ordered scope-&-sequence
and exploded into the existing break-aware weekly pacing.

## Flow

```
upload (text/PDF/image → extracted text, any size)
   │
   ▼
ai-svc  POST /api/ai/curriculum/parse-term
   │   term_syllabus_parser.py
   │   • splits the document on week/unit boundaries (no 16KB truncation —
   │     large docs are chunked, never dropped)
   │   • LLM extracts units per chunk; deterministic heuristic fallback so a
   │     parse never hard-fails
   ▼
scope-&-sequence  { terms: [ { units: [ {title, duration_weeks, topics,
   │                 learning_objectives, standards_addressed, key_vocabulary} ] } ] }
   ▼
persist  term_syllabi + term_syllabus_units  (migration 0068)
   │   web-v2 lib/learner/term-syllabus.ts → flattenToUnits()
   ▼
brain-svc  POST /api/.../pacing-plan/generate  { source: "uploaded_term_syllabus",
   │        term_scope_sequence }
   │   pacing_engine.normalize_uploaded_scope() → build_pacing_weeks()
   ▼
12 dated weekly foci (break-aware) the tutor consumes
```

## Key properties

- **No 32 KB cap.** `split_into_chunks` packs the document into chunks on
  unit boundaries; the concatenation of chunks reproduces the input exactly
  (`test_term_syllabus_parser.py::TestChunkingNoTruncation`).
- **Never hard-fails.** If the LLM is unavailable or errors, the heuristic
  parser runs and still yields units.
- **Uploaded scope is authoritative.** When `source=uploaded_term_syllabus`,
  brain-svc paces the uploaded term verbatim — no AI-guessed scope, no
  brain-state requirement — while staying break-aware.

## Where it lives

| Piece | File |
| ----- | ---- |
| Parser + route | `services/ai-svc/.../term_syllabus_parser.py`, `routes/term_syllabus.py` |
| Pacing | `services/brain-svc/.../pacing_engine.py` (`normalize_uploaded_scope`), `routes/pacing.py` |
| Persistence | `packages/db/src/schema/term_syllabus.ts`, `packages/db/drizzle/0068_term_syllabus.sql` (+ `0069_syllabus_validation.sql`) |
| Client mapping | `apps/web-v2/lib/learner/term-syllabus.ts`, `lib/db/types.ts` |
| BFF + routes | `apps/web-v2/lib/bff/term-syllabus.ts`, `app/api/bff/{parent,teacher}/learners/[learnerId]/term-syllabus/*` |
| UI | `apps/web-v2/components/curriculum/term-syllabus-manager.tsx` |

## Jurisdiction validation (Sprint 7, G8)

On save, the BFF validates the syllabus's topics/standards against the
learner's jurisdiction-approved packs via curriculum-svc
`POST /api/curriculum/validate` (`matched` / `unmatched` / `suggestions`):

- Each unit is stamped `validation_status` (`in_curriculum` /
  `off_curriculum` / `unvalidated`) + `validation_notes` (migration 0069).
- Off-curriculum items are **flagged for review** in the UI — never
  silently accepted. In-curriculum topics map to real skill ids.
- A standard matches only on an exact catalogue-id match; topics match by
  deterministic token overlap (`curriculum_svc/validation.py`).
