# Homework Helper

The homework helper supports learners through schoolwork the school
assigned. It does **not** replace the learner's classroom work. It
adapts the work to the learner's profile and guides them through a
structured four-step process.

## Four-Step Contract

```
UNDERSTAND
- Identify what the school problem is asking.
- Rephrase it at the learner's access level.
- Identify key terms and known values.

PLAN
- Select strategy.
- Choose surface: scratchpad, geometry workspace, number line, annotation,
  diagram, or choice grid.
- Model one similar step when needed.

SOLVE
- Learner attempts the next step.
- Tutor gives micro-hints before larger hints.
- Recognizer services analyze work when available.

CHECK
- Verify answer.
- Connect adapted work back to original school assignment.
- Summarize transferable strategy.
```

The step engine (`homework-step-engine.ts`) enforces order: the helper
cannot reveal a final answer until SOLVE has been entered. Tests lock
this guard.

## Service API

```
POST   /api/homework-sessions
POST   /api/homework-sessions/:id/upload
POST   /api/homework-sessions/:id/extract
POST   /api/homework-sessions/:id/step
POST   /api/homework-sessions/:id/focus-check
POST   /api/homework-sessions/:id/complete
GET    /api/homework-sessions/learner/:learnerId/recent
```

## OCR

`HomeworkOcrProvider` is an interface; the default
`TextOnlyHomeworkOcrProvider` handles typed-text uploads and splits them
into individual problems via blank-line and numbered-prompt heuristics.
Image OCR providers can register against the interface without changes
to routes or schemas. Failures return a safe empty result instead of
throwing.

## Profile Adaptation

`adaptHomeworkForProfile` derives:

- `reducedText` for LOW_VERBAL / PRE_SYMBOLIC learners
- `speechRequired = false` for NON_VERBAL learners
- recommendedSurfaces based on subject + topic
- scaffolds (model first, choice-based responses, extended time)
- UI adjustments (reduce motion, quiet mode, high contrast, large
  controls, shorter prompts, audio gating)

## Feature Flag

The helper runs only when `AIVO_FEATURE_SELF_REGULATION_HUB=true`. With
the flag off, the existing tutor-svc homework route continues to be the
authoritative homework path.
