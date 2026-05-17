# @aivo/web-v2

The AIVO Learning v2 rebuild. Built from the granular sprint plan.

## Status

- **Sprint 0** ✅ — repo foundation: env validation, BFF helpers, observability, error boundaries, 404, health probe.
- **Sprint 1** ✅ — design system + role-aware app shells for parent, learner, teacher, school admin, district admin, platform admin.
- **Sprint 2+** — pending.

## Commands

```bash
pnpm --filter @aivo/web-v2 dev         # start dev server on :5000
pnpm --filter @aivo/web-v2 build       # production build
pnpm --filter @aivo/web-v2 lint
pnpm --filter @aivo/web-v2 typecheck
pnpm --filter @aivo/web-v2 test        # vitest
pnpm --filter @aivo/web-v2 e2e         # playwright
```

## Layout

```
app/                 Next.js App Router routes
  api/bff/*          Backend-for-frontend route handlers
  parent/*           Parent shell + routes
  learner/*          Learner shell + routes
  teacher/*          Teacher shell + routes
  admin/*            School / district / platform admin shells
  settings/*         Cross-role settings (accessibility)
components/
  ui/                Reusable shadcn-style primitives
  layout/            App shell, page header, role nav
  learner/           Learner-facing UI (avatar, subject icon, mission card…)
lib/
  auth/              Mock session + role types (swap for Clerk/Auth.js later)
  bff/               Success/failure helpers, guards, requestId
  observability/     Pino logger
  env.ts             Zod-validated server + client env
middleware.ts        Request ID stamping
```

## Auth

Sprint 2 will swap the mock auth in `lib/auth/mock-session.ts` for a real
provider. The session shape (`SessionProfile`) and the role-routing map
(`ROLE_HOME`) are stable and won't change.
