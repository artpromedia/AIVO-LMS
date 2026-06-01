/**
 * React Query v5 hooks for the AIVO API clients.
 *
 * Importing this entry point pulls in `@tanstack/react-query` and
 * `react`. Keep that out of the default `@aivo/api-client` import path
 * — server-side jobs and CLIs don't need React.
 */
export * from "./learning-hooks.js";
export * from "./learner-scoped.js";
