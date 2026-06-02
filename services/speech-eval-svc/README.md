# speech-eval-svc

Lightweight Fastify service that evaluates learner voice recordings:
ASR transcript + pronunciation/fluency scores.

## Endpoint

```
POST /api/speech-eval/evaluate
Content-Type: multipart/form-data

Fields:
  audio       — binary audio blob (webm, mp4, ogg, …)
  targetText  — the phrase/passage the learner was asked to say
  language    — BCP-47 code, e.g. "en-US" or "es-MX"
```

### Response

```json
{
  "transcript": "Sunday Monday Tuesday",
  "scores": {
    "pronunciation": 82,
    "fluency": 78,
    "perWord": [{ "word": "sunday", "score": 85 }, ...]
  },
  "degraded": true,
  "language": "en-US"
}
```

`degraded: true` is returned whenever mock scores are used (see below).

## Feature flag

| `SPEECH_EVAL_MODE` | Behaviour                                                                                                                              |
| ------------------ | -------------------------------------------------------------------------------------------------------------------------------------- |
| `mock` (default)   | Returns deterministic mock scores with `degraded: true`. No Whisper or cloud ASR required. Use this until real hosting is provisioned. |
| `live`             | Stub — returns 503 until a real Whisper integration is wired.                                                                          |

## Development

```bash
SPEECH_EVAL_MODE=mock pnpm dev
```

Service starts on port `3080` (override with `SPEECH_EVAL_PORT`).

Swagger UI: http://localhost:3080/docs
