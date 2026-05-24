# Multimedia item fixtures

These fixtures seed Sprint 3.3 lesson-player media coverage for Math, ELA, and Science.

## Media URLs

- Fixture media `src` values use `https://example.com/...` placeholder URLs (non-production).
- Captions are authored locally as `.vtt` files under `packages/item-bank/fixtures/captions/` and referenced from each item's `assets[]` entry.

## Subject files

- `items/math.multimedia.json` (10 items)
- `items/ela.multimedia.json` (10 items)
- `items/science.multimedia.json` (10 items)

Each item uses `surfaceType: "video"` or `surfaceType: "audio"` and includes a required captions asset.
