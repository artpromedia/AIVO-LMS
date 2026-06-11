# Vendored curriculum sources

Machine-readable source data for the deterministic catalogue importers.
These files are **inputs** — the committed artifact they produce is
`packages/content-pack/data/us-ccss/catalogue.imported.json`
(via `services/curriculum-svc/scripts/import_ccss.py`), which
`build_snapshot.py` folds into the curriculum-svc snapshot. CI verifies
both transforms with `--check`, so nothing here is read at runtime.

## ccss/

The official **Common Core State Standards**, K–8 Mathematics and
English Language Arts (one JSON file per subject × grade), fetched from
the Common Standards Project API
(`https://api.commonstandardsproject.com/api/v1/standard_sets/…`,
jurisdiction "Common Core State Standards").

- **License:** CC BY 3.0 US (recorded per-file under `data.license`).
  © Copyright 2010 National Governors Association Center for Best
  Practices and Council of Chief State School Officers. All rights
  reserved. Used under the public license; standard codes and statement
  text are reproduced verbatim (ADR-0041: standards are never invented
  or paraphrased into authority).
- **Refresh:** re-fetch the affected `standard_sets` files, re-run
  `import_ccss.py`, review the diff, commit.

## nces/

`top-districts.json` — the top US school districts by enrollment from
the **NCES Common Core of Data** LEA directory (public domain, US
federal data), republished by the Urban Institute Education Data API.

- **Refresh:** `node scripts/import-districts.mjs --year <ccd-year> --top <n>`,
  review the diff, re-run `import_ccss.py`, commit.
