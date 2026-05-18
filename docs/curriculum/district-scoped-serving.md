# District-scoped curriculum serving

AIVO must not serve generic curriculum to a learner when the learner's enrollment ZIP code maps to a district-specific curriculum catalogue.

## Runtime rule

Enrollment captures the learner's ZIP code. Curriculum consumers must pass that ZIP code to `curriculum-svc` when requesting skills, packs, or prerequisite paths.

The curriculum service resolves:

```text
learner enrollment ZIP code -> district -> district-approved content packs -> served skills
```

## API contract

### Resolve district

```http
GET /api/curriculum/districts/resolve?zipCode=55104
```

Returns the district that owns the curriculum serving context for the ZIP code.

### Lookup curriculum

```http
GET /api/curriculum/lookup?subject=math&gradeBand=K&zipCode=55104
```

`zipCode` is required. The response includes only content packs assigned to the resolved district and only skills included in those packs.

### Skill path

```http
GET /api/curriculum/skills/ccss.math.k.cc.b.4/path?zipCode=55104
```

The prerequisite path is filtered to the learner's district curriculum. If the target skill is not available in the resolved district, the service returns `403`.

## Failure behavior

- malformed ZIP code: `400`
- ZIP code without district mapping: `404`
- known skill not available to the learner's district: `403`
- missing `zipCode` on learner-serving routes: FastAPI validation `422`

## Snapshot shape

The bundled read-only snapshot now supports:

```json
{
  "districts": [
    {
      "id": "mn-stpaul-public-schools",
      "name": "Saint Paul Public Schools",
      "state": "MN",
      "zipCodes": ["55104"]
    }
  ],
  "contentPacks": [
    {
      "id": "mn-stpaul-k-math-fall-2026",
      "districtIds": ["mn-stpaul-public-schools"],
      "skillIds": ["ccss.math.k.cc.a.1"]
    }
  ]
}
```

## Enrollment integration requirement

Enrollment should persist the learner ZIP code and pass it into curriculum lookup calls during baseline generation, lesson generation, mastery tracking, and tutor routing. Callers should not cache curriculum responses across learners unless the cache key includes district id or normalized ZIP code.
