import Link from "next/link";
import { Button } from "@/components/ui/button";

// /404 is rendered by Next 15's static export AND the legacy Pages
// Router /_error fallback. The Pages fallback runs outside a request
// scope, so calling cookies()/getTranslations() inside this file or its
// imported helpers triggers the misleading
// "<Html> should not be imported outside of pages/_document" error.
// Keep this component request-free and translation-free.
//
// `force-static` keeps it out of the dynamic-render path that the
// root layout opts into, so the prerender uses this exact component
// (no cookie reads) instead of falling through to /_error.
export const dynamic = "force-static";

export default function NotFound() {
  return (
    <main
      id="main"
      className="mx-auto flex min-h-[70vh] max-w-xl flex-col items-center justify-center px-6 py-16 text-center"
    >
      <p className="text-sm font-medium uppercase tracking-wide text-aivo-muted">404</p>
      <h1 className="mt-2 font-display text-4xl font-bold">Page not found</h1>
      <p className="mt-3 text-aivo-ink-soft">
        The link may have moved, or maybe it never existed. Either way, you&apos;re in good company
        — let&apos;s get you home.
      </p>
      <div className="mt-6">
        <Button asChild>
          <Link href="/">Back to home</Link>
        </Button>
      </div>
    </main>
  );
}
