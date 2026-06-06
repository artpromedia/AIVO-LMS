FROM node:22-alpine AS base
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable
WORKDIR /app

FROM base AS deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json ./
COPY apps/web-admin/package.json apps/web-admin/package.json
COPY packages packages
RUN pnpm install --frozen-lockfile

FROM deps AS builder
COPY . .
RUN pnpm turbo build --filter=@aivo/web-admin

FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=5001
ENV HOSTNAME=0.0.0.0
RUN addgroup -S nodejs && adduser -S nextjs -G nodejs
COPY --from=builder /app/apps/web-admin/.next/standalone ./
COPY --from=builder /app/apps/web-admin/.next/static ./apps/web-admin/.next/static
COPY --from=builder /app/apps/web-admin/public ./apps/web-admin/public
USER nextjs
EXPOSE 5001
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 CMD wget -qO- http://127.0.0.1:5001/api/health || exit 1
CMD ["node", "apps/web-admin/server.js"]
