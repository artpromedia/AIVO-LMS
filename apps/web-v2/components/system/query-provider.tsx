"use client";

/**
 * App-wide TanStack Query client.
 *
 * Defaults tuned for a calm learning product:
 *   - queries: 2 retries with exponential backoff, 30s staleTime, and no
 *     refetch-on-focus (surprise reloads are sensory noise for learners);
 *   - retries skip non-retryable BFF errors (the envelope says whether a
 *     failure is worth retrying — a 403 never is);
 *   - mutations don't auto-retry: writes either carry an Idempotency-Key
 *     and go through the offline outbox (lesson player) or surface a toast
 *     with an explicit retry action.
 */
import * as React from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { isBffError } from "@/lib/api/client";

function makeClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: (failureCount, error) => {
          if (isBffError(error) && !error.retryable) return false;
          return failureCount < 2;
        },
        staleTime: 30_000,
        refetchOnWindowFocus: false,
      },
      mutations: { retry: false },
    },
  });
}

export function QueryProvider({ children }: { children: React.ReactNode }) {
  const [client] = React.useState(makeClient);
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}
