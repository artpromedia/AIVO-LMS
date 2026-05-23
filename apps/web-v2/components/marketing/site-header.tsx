"use client";

import * as React from "react";
import Image from "next/image";
import Link from "next/link";
import { Menu } from "lucide-react";
import { SensoryModeToggle } from "@/components/system/sensory-mode-provider";
import { LanguageSwitcher } from "@/components/language-switcher";
import { Button } from "@/components/ui/button";
import {
  Drawer,
  DrawerTrigger,
  DrawerContent,
} from "@/components/ui/drawer";

/**
 * Inclusive-Warm marketing-style top chrome for unauthenticated web-v2
 * surfaces (`/`, `/login`, `/signup`). Mirrors apps/marketing's
 * StickyHeader so the brand wordmark, sensory-mode pill, and sign-in
 * + get-started CTAs are reachable from the demo landing.
 *
 * Below md the nav links + Sign-in collapse into a hamburger → drawer
 * so first-time mobile visitors can still reach About / For Districts /
 * Sign-in without scrolling past the hero. Get-started stays inline as
 * the always-visible primary CTA on every breakpoint.
 *
 * Authenticated dashboards have their own AppShell chrome and do not
 * render this header.
 */
const NAV_LINKS = [
  { label: "Platform", href: "/#roles" },
  { label: "Research", href: "/#roles" },
  { label: "For Districts", href: "/admin/district" },
  { label: "Families", href: "/parent/home" },
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
                {NAV_LINKS.map((link) => (
                  <DrawerLink key={link.label} href={link.href}>
                    {link.label}
                  </DrawerLink>
                ))}
                <div className="my-3 h-px bg-iw-border" />
                <DrawerLink href="/login">Sign in</DrawerLink>
              </nav>
              <div className="mt-6 flex items-center gap-3">
                <SensoryModeToggle size="sm" />
                <LanguageSwitcher />
              </div>
              <Button asChild variant="default" size="lg" className="mt-6 w-full">
                <Link href="/signup">Get started</Link>
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
              className="h-9 w-auto md:h-11"
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

        <div className="flex shrink-0 items-center gap-2 sm:gap-3">
          <LanguageSwitcher />
          <div className="hidden sm:block">
            <SensoryModeToggle size="xs" />
          </div>
          <Link
            href="/login"
            className="hidden min-h-11 items-center rounded-full px-4 py-2 text-sm font-semibold text-iw-ink-muted transition hover:bg-iw-warm-soft hover:text-iw-ink md:inline-flex"
          >
            Sign in
          </Link>
          <Link
            href="/signup"
            className="inline-flex min-h-10 items-center rounded-full bg-iw-primary px-4 py-2 text-sm font-semibold text-iw-primary-fg shadow-soft-1 transition hover:bg-iw-primary-hover md:min-h-11 md:px-5 md:py-2.5"
          >
            Get started
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
