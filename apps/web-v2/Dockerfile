# web-v2 (learner/parent/district surface) production image.
#
# Mirrors apps/web-admin/Dockerfile so the district-pilot e2e harness can
# bring web-v2 up against the real identity-svc / billing-svc / comms-svc
# mesh. Build context is the repo root (see docker-compose.e2e.yml).
#
# next.config.ts sets `output: "standalone"`; the runner stage copies the
# standalone server + static assets and boots `apps/web-v2/server.js`.
FROM node:22-alpine AS base
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable
WORKDIR /app

FROM base AS deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json ./
# Workspace `prepare` scripts (tsc) extend both root TS configs; copy both so
# `pnpm install` can compile packages (else TS5083 / TS2802). Keep in sync with
# apps/web-admin/Dockerfile.
COPY tsconfig.json tsconfig.base.json ./
COPY apps/web-v2/package.json apps/web-v2/package.json
COPY packages packages
RUN pnpm install --frozen-lockfile

FROM deps AS builder
COPY . .
# web-v2's build script runs `build:brand` (the @aivo/brand token build)
# before `next build`; turbo runs the package script so brand tokens are
# present in the standalone bundle.
RUN pnpm turbo build --filter=@aivo/web-v2

FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=5000
ENV HOSTNAME=0.0.0.0
RUN addgroup -S nodejs && adduser -S nextjs -G nodejs
COPY --from=builder /app/apps/web-v2/.next/standalone ./
COPY --from=builder /app/apps/web-v2/.next/static ./apps/web-v2/.next/static
COPY --from=builder /app/apps/web-v2/public ./apps/web-v2/public
USER nextjs
EXPOSE 5000
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
  CMD wget -qO- http://127.0.0.1:5000/api/bff/health || exit 1
CMD ["node", "apps/web-v2/server.js"]
