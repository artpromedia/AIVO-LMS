/**
 * @aivo/ui/auth
 *
 * Calm primitives for the AIVO authentication, consent, and first-run
 * experience. Composes on top of @aivo/ui/surface (GlassCard) and
 * @aivo/ui/icon (AivoIcon).
 *
 * Components:
 *   Auth/AuthShell        — page canvas + brand rail
 *   Auth/AuthCard         — the single card per step
 *   Auth/AuthInput        — calm 48px text input
 *   Auth/ReassuranceCard  — "why are you asking me this?" sidecar
 *   Auth/LegalCollapse    — progressive-disclosure legal text
 *   Auth/StepperHeader    — 3–5 step indicator
 *   Auth/ConsentRow       — one explicit consent question, never bundled
 */
export * from "./AuthShell.js";
export * from "./AuthCard.js";
export * from "./AuthInput.js";
export * from "./ReassuranceCard.js";
export * from "./LegalCollapse.js";
export * from "./StepperHeader.js";
export * from "./ConsentRow.js";
