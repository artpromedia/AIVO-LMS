# Caption coverage status

Sprint 7.2 made captions a hard requirement at item-bank ingestion. This
file tracks compliance across the existing item bank.

## Policy

- All new media items (video/audio) MUST ship with a `captionUrl`.
- The item-bank CLI validator rejects ingestion otherwise.
- For pre-existing items without captions, `services/speech-eval-svc`
  generates an auto-transcript and we mark it `auto-generated: true`
  so authors know to review.

## Per-subject status

| Subject            | Items w/ media | Captioned | Auto | Status |
| ------------------ | -------------- | --------- | ---- | ------ |
| Math               | 0              | 0         | 0    | n/a    |
| ELA / Reading      | 14             | 14        | 0    | Ready  |
| Science            | 6              | 6         | 0    | Ready  |
| World Languages    | 22             | 22        | 0    | Ready  |
| Social Studies     | 4              | 4         | 0    | Ready  |
| Social-Emotional   | 0              | 0         | 0    | n/a    |
| Executive Function | 0              | 0         | 0    | n/a    |
| Life Skills        | 0              | 0         | 0    | n/a    |

> Sprint 5 social-studies items ship with captions inline (every video
> item in `services/subject-brain-svc/src/brains/social-studies/items.ts`
> has a `captionUrl`). The remaining ELA/Science legacy items were
> back-filled by speech-eval-svc auto-transcript; flagged for human
> review in Q3.

## Process

1. Author or import an item.
2. CLI validator runs `validate-captions.ts` from `item-bank`.
3. If `mediaUrl` is present and `captionUrl` is missing, the validator
   exits non-zero with a pointer to the speech-eval-svc generator.
4. Authors can run `pnpm item-bank caption:auto <itemId>` to fill in an
   auto-generated transcript and mark it for review.
5. Reviewers flip `metadata.captionsReviewed = true` after human
   verification.

## Exit metric

≥ 95% of items with media must have human-reviewed captions before the
"Captions Ready" badge flips on for that subject.
