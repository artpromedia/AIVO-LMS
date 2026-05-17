# Subject Brain Architecture

The subject brain layer enriches the existing Brain (learner) context with
subject-specific knowledge: skill graphs, curriculum standards, mastery
gaps, misconception risks, and recommended surfaces/scaffolds. Tutors and
content generators consume this context so generated lessons and
homework adaptations carry deliberate pedagogical intent — not just
stylistic adornment.

## Components

- `MathSubjectBrain` — geometry, fractions, arithmetic
- `ScienceSubjectBrain` — classification, sequencing, observation/inference
- `ElaSubjectBrain` — comprehension, vocabulary, writing scaffold
- `WorldLanguageSubjectBrain` — CEFR levels, listen/speak/read/write modes
- `skill-graph-store` — small in-process skill graph keyed by topic keywords
- `misconception-store` — common misconceptions per subject/topic
- `profile-adaptations` — functioning-level and accommodation guidance

## API

```
POST /api/subject-brain/context
```

Request:

```ts
{
  learnerId: string;
  subject: "math" | "science" | "ela" | "world_language" | "coding" | "social_studies";
  topic?: string;
  gradeTarget?: string;
  deliveryLevel?: string;
  functioningLevel?: string;
  brainContext: Record<string, unknown>;
}
```

Response:

```ts
{
  subject: string;
  topic?: string;
  relevantSkills: string[];
  prerequisiteSkills: string[];
  masteryGaps: Array<{ skillCode: string; mastery: number; severity: "low" | "medium" | "high" }>;
  misconceptionRisks: Array<{ id: string; label: string; intervention: string }>;
  recommendedSurfaces: string[];
  recommendedScaffolds: string[];
  standards: Array<{ framework: string; code: string; description: string }>;
  profileAdaptations: string[];
}
```

## Integration

- `learning-svc` calls `/api/subject-brain/context` before invoking ai-svc
  generation. The StagePlan validator requires `subjectBrainEvidenceUsed`
  to appear in the generated plan.
- `tutor-svc` uses subject brain context for chat and homework prompt
  construction.
- When the `advancedContentGenerators` flag is off, the legacy generator
  path is preserved unchanged.

## Validator Hooks

Generated StagePlans fail validation when:

- Subject-brain context exists but no evidence is recorded.
- Math geometry plan lacks geometry surface.
- Computation plan lacks scratchpad.
- ELA plan lacks chunking or annotation for reduced-text profiles.
- Science plan lacks diagram/classification/sequence support when needed.
- Profile adaptations are empty despite accommodations/functioning-level
  needs.
