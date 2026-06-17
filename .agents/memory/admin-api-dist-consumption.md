---
name: admin-api consumed via built dist
description: web-admin imports @aivo/admin-api from compiled dist, not src — rebuild after type changes
---

`apps/web-admin` imports `@aivo/admin-api` (and its subpaths like
`@aivo/admin-api/school`) through the package's `exports`, which point at
`packages/admin-api/dist/*.d.ts` / `*.js`, **not** the TypeScript source.

**Why:** changing a type in `packages/admin-api/src/*.ts` and running
`pnpm --filter @aivo/admin-api typecheck` passes (it checks its own src), but
`pnpm --filter @aivo/web-admin typecheck` still sees the **old** shape and fails
with "has no exported member" / "Property does not exist" until dist is rebuilt.

**How to apply:** after editing any `packages/admin-api/src` type or export, run
`pnpm --filter @aivo/admin-api build` before typechecking/linting web-admin. Same
pattern applies to other `@aivo/*` packages whose `exports` resolve to `dist/`
(e.g. admin-ui).
