"use client";

import * as React from "react";
import Image from "next/image";
import Link from "next/link";
import { Menu } from "lucide-react";
import { SensoryModeToggle } from "@/components/system/sensory-mode-provider";
import { LanguageSwitcher } from "@/components/language-switcher";
import { Button } from "@/components/ui/button";
import { Drawer, DrawerTrigger, DrawerContent } from "@/components/ui/drawer";

/**
 * Inclusive-Warm marketing-style top chrome for unauthenticated web-v2
 * surfaces (`/`, `/login`, `/signup`). Mirrors apps/marketing's
 * StickyHeader so the brand wordmark, sensory-mode pill, and sign-in
 * + get-started CTAs are reachable from the demo landing.
 *
 * Below md the nav links + Log-in collapse into a hamburger → drawer
 * so first-time mobile visitors can still reach the audience pages +
 * Log-in without scrolling past the hero. Start Free Trial stays inline
 * as the always-visible primary CTA on every breakpoint.
 *
 * Authenticated dashboards have their own AppShell chrome and do not
 * render this header.
 */
const MARKETING_SITE = (
  process.env.NEXT_PUBLIC_MARKETING_URL ??
  process.env.NEXT_PUBLIC_SITE_URL ??
  "https://aivolearning.com"
).replace(/\/+$/, "");

function marketingHref(path: string) {
  return `${MARKETING_SITE}${path.startsWith("/") ? path : `/${path}`}`;
}

// Mirrors apps/marketing's StickyHeader nav so the two public landing pages
// match. The audience pages + Pricing + Resources live only on the marketing
// site, so they resolve against NEXT_PUBLIC_MARKETING_URL and ship as external
// <a> links; Features anchors to this page's own features section.
const NAV_LINKS = [
  { label: "For Parents", href: marketingHref("/for-parents"), external: true },
  { label: "For Teachers", href: marketingHref("/for-teachers"), external: true },
  { label: "For Schools", href: marketingHref("/for-schools"), external: true },
  { label: "Features", href: "/#features-heading" },
  { label: "Pricing", href: marketingHref("/pricing"), external: true },
  { label: "Resources", href: marketingHref("/resources"), external: true },
];

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 w-full border-b border-iw-border bg-iw-bg/85 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-3 px-4 sm:gap-4 sm:px-6 md:h-20 md:px-8">
        <div className="flex min-w-0 items-center gap-3 md:gap-8">
          {/* Mobile nav trigger — opens a drawer with the same links.
              Hidden once the inline nav is visible (md+). */}
          <Drawer>
            <DrawerTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="md:hidden -ml-2 shrink-0"
                aria-label="Open navigation"
              >
                <Menu className="h-5 w-5" aria-hidden="true" />
              </Button>
            </DrawerTrigger>
            <DrawerContent side="left" className="bg-iw-bg p-6">
              <Image
                src="/images/aivo-logo-purple.png"
                alt="AIVO Learning"
                width={140}
                height={42}
                className="mb-6 h-9 w-auto"
              />
              <nav
                aria-label="Primary"
                className="flex flex-col gap-1 text-base font-semibold text-iw-ink"
              >
                {NAV_LINKS.map((link) =>
                  link.external ? (
                    <a
                      key={link.label}
                      href={link.href}
                      className="rounded-lg px-3 py-2 hover:bg-iw-warm-soft"
                    >
                      {link.label}
                    </a>
                  ) : (
                    <DrawerLink key={link.label} href={link.href}>
                      {link.label}
                    </DrawerLink>
                  ),
                )}
                <div className="my-3 h-px bg-iw-border" />
                <DrawerLink href="/login">Log In</DrawerLink>
              </nav>
              <div className="mt-6 flex items-center gap-3">
                <SensoryModeToggle size="sm" />
                <LanguageSwitcher />
              </div>
              <Button asChild variant="default" size="lg" className="mt-6 w-full">
                <Link href="/signup">Start Free Trial</Link>
              </Button>
            </DrawerContent>
          </Drawer>

          <Link
            href="/"
            aria-label="AIVO Learning home"
            className="inline-flex shrink-0 items-center rounded-full px-1 py-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-iw-ring"
          >
            <Image
              src="/images/aivo-logo-purple.png"
              alt="AIVO Learning"
              width={160}
              height={48}
              priority
              className="h-8 w-auto md:h-10"
            />
          </Link>
          <nav
            aria-label="Primary"
            className="hidden items-center gap-5 text-sm font-semibold text-iw-ink-muted md:flex lg:gap-7"
          >
            {NAV_LINKS.map((link) =>
              link.external ? (
                <a
                  key={link.label}
                  href={link.href}
                  className="whitespace-nowrap transition-colors hover:text-iw-ink"
                >
                  {link.label}
                </a>
              ) : (
                <Link
                  key={link.label}
                  href={link.href}
                  className="whitespace-nowrap transition-colors hover:text-iw-ink"
                >
                  {link.label}
                </Link>
              ),
            )}
          </nav>
        </div>

        <div className="flex shrink-0 items-center gap-2 sm:gap-3">
          <LanguageSwitcher />
          <Link
            href="/login"
            className="hidden min-h-11 items-center rounded-full px-4 py-2 text-sm font-semibold text-iw-ink-muted transition hover:bg-iw-warm-soft hover:text-iw-ink md:inline-flex"
          >
            Log In
          </Link>
          <Link
            href="/signup"
            className="inline-flex min-h-10 items-center rounded-full bg-iw-primary px-4 py-2 text-sm font-semibold text-iw-primary-fg shadow-soft-1 transition hover:bg-iw-primary-hover md:min-h-11 md:px-5 md:py-2.5"
          >
            Start Free Trial
          </Link>
        </div>
      </div>
    </header>
  );
}

function DrawerLink({
  href,
  children,
}: {
  readonly href: string;
  readonly children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className="rounded-iw-control px-3 py-2.5 text-iw-ink hover:bg-iw-warm-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-iw-ring"
    >
      {children}
    </Link>
  );
}
