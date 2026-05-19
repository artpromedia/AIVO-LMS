import Image from "next/image";
import Link from "next/link";
import { SensoryModeToggle } from "@/components/system/sensory-mode-provider";

/**
 * Inclusive-Warm marketing-style top chrome for unauthenticated web-v2
 * surfaces (currently `/`). Mirrors apps/marketing's StickyHeader so the
 * brand wordmark, sensory-mode pill, and sign-in/get-started CTAs are
 * reachable from the demo landing.
 *
 * Authenticated dashboards have their own AppShell chrome and do not
 * render this header.
 */
export function SiteHeader() {
  const NAV_LINKS = [
    { label: "Platform", href: "/#roles" },
    { label: "Research", href: "/#roles" },
    { label: "For Districts", href: "/admin/district" },
    { label: "Families", href: "/parent/home" },
  ];

  return (
    <header className="sticky top-0 z-40 w-full border-b border-iw-border bg-iw-bg/85 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-6 md:h-20 md:px-8">
        <div className="flex items-center gap-8">
          <Link
            href="/"
            aria-label="AIVO Learning home"
            className="inline-flex items-center rounded-full px-1 py-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-iw-ring"
          >
            <Image
              src="/images/aivo-logo-purple.png"
              alt="AIVO Learning"
              width={160}
              height={48}
              priority
              className="h-10 w-auto md:h-12"
            />
          </Link>
          <nav
            aria-label="Primary"
            className="hidden items-center gap-7 text-sm font-semibold text-iw-ink-muted md:flex"
          >
            {NAV_LINKS.map((link) => (
              <Link
                key={link.label}
                href={link.href}
                className="transition-colors hover:text-iw-ink"
              >
                {link.label}
              </Link>
            ))}
          </nav>
        </div>

        <div className="flex items-center gap-3">
          <div className="hidden sm:block">
            <SensoryModeToggle />
          </div>
          <Link
            href="/login"
            className="hidden min-h-11 items-center rounded-full px-4 py-2 text-sm font-semibold text-iw-ink-muted transition hover:bg-iw-warm-soft hover:text-iw-ink md:inline-flex"
          >
            Sign in
          </Link>
          <Link
            href="/signup"
            className="inline-flex min-h-11 items-center rounded-full bg-iw-primary px-5 py-2.5 text-sm font-semibold text-iw-primary-fg shadow-soft-1 transition hover:bg-iw-primary-hover"
          >
            Get started
          </Link>
        </div>
      </div>
    </header>
  );
}
