"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";

/**
 * Detects the Next.js ``UnrecognizedActionError`` — a Server Action ID
 * baked into the cached client bundle no longer exists on the server
 * after a redeploy. The user's tab is stale; a hard reload pulls the
 * fresh bundle whose action IDs match the server.
 */
function isStaleServerActionError(error: Error): boolean {
  const msg = `${error.name} ${error.message}`;
  return /UnrecognizedActionError|Server Action .* was not found/i.test(msg);
}

const RELOAD_FLAG_KEY = "aivo:auto-reloaded-for-stale-action";

export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const t = useTranslations("root.error");
  const [autoRecovering, setAutoRecovering] = useState(false);

  useEffect(() => {
    console.error("[app/error]", error);

    if (typeof window === "undefined") return;
    if (!isStaleServerActionError(error)) return;
    // Guard against an infinite reload loop: only auto-reload once per
    // session. If the error persists after a hard reload, fall through
    // to the normal error UI so the user can see it.
    try {
      if (window.sessionStorage.getItem(RELOAD_FLAG_KEY)) return;
      window.sessionStorage.setItem(RELOAD_FLAG_KEY, "1");
    } catch {
      // sessionStorage may be unavailable (private mode); skip auto-reload.
      return;
    }
    setAutoRecovering(true);
    // Use ``replace`` so the broken state isn't kept in history, and
    // append a cache-buster so any intermediate proxy can't serve a
    // stale HTML document.
    const url = new URL(window.location.href);
    url.searchParams.set("_r", Date.now().toString(36));
    window.location.replace(url.toString());
  }, [error]);

  if (autoRecovering) {
    return (
      <main
        id="main"
        className="mx-auto flex min-h-[70vh] max-w-xl flex-col items-center justify-center px-6 py-16 text-center"
      >
        <p className="text-sm font-medium uppercase tracking-wide text-aivo-ink-soft">
          {t("refreshing")}
        </p>
        <h1 className="mt-2 font-display text-3xl font-bold">{t("one_moment")}</h1>
      </main>
    );
  }

  return (
    <main
      id="main"
      className="mx-auto flex min-h-[70vh] max-w-xl flex-col items-center justify-center px-6 py-16 text-center"
    >
      <p className="text-sm font-medium uppercase tracking-wide text-aivo-danger">
        {t("something_went_wrong")}
      </p>
      <h1 className="mt-2 font-display text-4xl font-bold">{t("lets_try_again")}</h1>
      <p className="mt-3 text-aivo-ink-soft">{t("unexpected_error")}</p>
      {error.digest ? (
        <p className="mt-2 text-xs text-aivo-muted">Reference: {error.digest}</p>
      ) : null}
      <div className="mt-6 flex gap-3">
        <Button onClick={() => reset()}>{t("try_again")}</Button>
        <Button variant="outline" onClick={() => (window.location.href = "/")}>
          {t("back_to_home")}
        </Button>
      </div>
    </main>
  );
}
