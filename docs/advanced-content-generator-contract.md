# Advanced Content Generator Contract

The advanced content generators (`math_generator`, `science_generator`,
`ela_generator`, `world_language_generator`) build StagePlan-shaped
activities from subject-brain context. They run before — and after —
the LLM is invoked, so the generated payload always carries explicit
evidence of how learner profile, mastery, and curriculum standards shaped
the activity.

## Required Output

Every generator returns a payload with:

```ts
{
  subject: string;
  topic?: string;
  surfaces: LearnerSurface[];
  scaffolds: string[];
  profileAdaptations: string[];
  subjectBrainEvidenceUsed: {
    relevantSkills?: string[];
    masteryGaps?: MasteryGap[];
    misconceptionRisks?: string[]; // ids only
    standards?: Standard[];
  };
}
```

`subjectBrainEvidenceUsed` is the validator's hook: a StagePlan that
omits this field will fail validation when subject-brain context exists.

## Subject Coverage

### Math

- Arithmetic, fractions, geometry, measurement, algebra readiness,
  statistics, word problems.
- Geometry topics (angles, triangles, rectangles, circles, polygons,
  area, perimeter, volume basics, coordinate geometry) emit a
  structured `geometry_workspace` surface.

### Science

- Classification, sequencing, observation vs inference, hypothesis,
  variables, cause/effect, diagram-based explanation.

### ELA

- Reading chunking, vocabulary preview, annotation, sentence frames,
  comprehension checks, writing scaffold.
- Lexile-style text-density adaptation when functioning level is
  `LOW_VERBAL` or `PRE_SYMBOLIC`.

### World Language

- CEFR-style level (A1–C2).
- Listening / speaking / reading / writing modes.
- TTS-ready prompts and cultural context.

## Profile Adaptations

Profile adaptations are appended (not replaced) so the subject-brain
context can chain additional accommodations. Examples:

- `LOW_VERBAL` → reduce text density, prefer visual surfaces.
- `NON_VERBAL` → no speech-required tasks; AAC-friendly choices.
- `reduced_motion` accommodation → disable non-essential animation.
- `high_contrast` accommodation → high-contrast palette.

## Feature Flag

The generators only run when `AIVO_FEATURE_ADVANCED_CONTENT_GENERATORS=true`.
With the flag off, learning-svc uses the existing generator path
unchanged.
