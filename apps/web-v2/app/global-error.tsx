"use client";

/* eslint-disable no-restricted-syntax -- global error boundary renders BEFORE the app's CSS/tokens are loaded (Next.js spec: global-error replaces the root layout when the layout itself crashes). Inline hex styles are intentional so the fallback works even when @aivo/brand/tokens.css fails to load. */

import { useEffect } from "react";
import { useTranslations } from "next-intl";
import * as Sentry from "@sentry/nextjs";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const t = useTranslations("root.global_error");
  useEffect(() => {
    // The root layout itself crashed — the one place this MUST be reported,
    // because nothing else is alive to do it.
    Sentry.captureException(error);
  }, [error]);
  return (
    <html lang="en">
      <body
        style={{ fontFamily: "system-ui, sans-serif", padding: "4rem 1.5rem", textAlign: "center" }}
      >
        <h1 style={{ fontSize: "1.75rem", fontWeight: 700 }}>{t("heading")}</h1>
        <p style={{ marginTop: "0.75rem", color: "#555" }}>{t("body")}</p>
        {error.digest ? (
          <p style={{ marginTop: "0.5rem", fontSize: "0.75rem", color: "#888" }}>
            Reference: {error.digest}
          </p>
        ) : null}
        <button
          onClick={() => reset()}
          style={{
            marginTop: "1.25rem",
            padding: "0.6rem 1rem",
            borderRadius: 8,
            background: "#3b3bd1",
            color: "white",
            border: 0,
            cursor: "pointer",
          }}
        >
          {t("try_again")}
        </button>
      </body>
    </html>
  );
}
