import pino from "pino";
import { serverEnv } from "@/lib/env";

// Note: we intentionally avoid `pino-pretty` transport here. Pino's worker
// transport (thread-stream) resolves its worker script to an absolute path at
// require time, and under Replit's pnpm cache that path is rewritten between
// the install root (`/ROOT/...`) and the live workspace, causing repeated
// uncaught "Cannot find module .../thread-stream/lib/worker.js" exceptions in
// the dev server. Plain JSON logging to stdout is sufficient for dev and is
// what we want in production anyway.
export const logger = pino({
  level: serverEnv.LOG_LEVEL,
  base: { app: "web-v2" },
});

export function newRequestId(): string {
  // Crypto.randomUUID is available in Node 18+/Edge.
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}
