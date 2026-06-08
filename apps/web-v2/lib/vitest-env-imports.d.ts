/**
 * Ambient declarations for the vitest cache-busting `?query` imports used in
 * `env.test.ts` (e.g. `import("./env?prod-auth-mock")`). The query string
 * forces vitest to re-evaluate `env.ts` under a freshly-mutated `process.env`
 * so each production-guard assertion runs in isolation. At runtime vitest
 * resolves these to the real `./env` module; TypeScript cannot resolve the
 * `?query` suffix, so we declare the variants here. They re-export the real
 * env module's types so `mod.serverEnv` stays typed.
 */
declare module "*?prod-auth-mock" {
  export * from "@/lib/env";
}
declare module "*?prod-ai-mock" {
  export * from "@/lib/env";
}
declare module "*?prod-persistence-memory" {
  export * from "@/lib/env";
}
declare module "*?prod-persistence-override-memory" {
  export * from "@/lib/env";
}
declare module "*?prod-session-placeholder" {
  export * from "@/lib/env";
}
declare module "*?prod-missing-db" {
  export * from "@/lib/env";
}
declare module "*?prod-missing-identity" {
  export * from "@/lib/env";
}
declare module "*?prod-all-real" {
  export * from "@/lib/env";
}
