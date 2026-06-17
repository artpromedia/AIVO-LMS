/**
 * Focused chrome for the teacher "Classroom insights" assessment flow.
 *
 * The reference design is a distraction-free task surface: the standard AIVO
 * TEACHER top bar (wordmark + notifications + user chip) over a centred
 * column — no dashboard sidebar. This layout wraps all three states (intro /
 * in-progress / review) so the chrome stays identical between them. RBAC and
 * roster scope are re-enforced per page (and again in the BFF on write).
 */
import * as React from "react";
import Link from "next/link";
import Image from "next/image";
import { requirePageRole } from "@/lib/auth/server";
import { getTenantBranding } from "@/lib/branding";
import { Avatar } from "@/components/ui/avatar";
import { BellIcon } from "@/components/teacher/assessment/shared";

export const dynamic = "force-dynamic";

export default async function TeacherAssessmentLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await requirePageRole(["teacher"]);
  const branding = await getTenantBranding();
  const school = branding?.displayName || "AIVO Learning";

  return (
    <div data-role-theme="teacher" data-role="teacher" className="min-h-screen bg-iw-bg text-iw-ink">
      <a href="#main" className="skip-link">
        Skip to main content
      </a>

      <header
        className="sticky top-0 z-40 border-b border-iw-border bg-iw-raised/85 backdrop-blur"
        aria-label="Application header"
      >
        <div className="mx-auto flex h-16 max-w-5xl items-center gap-3 px-4 sm:px-6">
          <Link
            href="/teacher"
            aria-label="AIVO Teacher home"
            className="inline-flex items-center gap-2 rounded-full px-1 py-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-iw-ring"
          >
            <Image
              src="/images/aivo-logo-purple.png"
              alt="AIVO Learning"
              width={120}
              height={36}
              priority
              className="h-8 w-auto"
            />
            <span className="hidden text-[11px] font-bold uppercase tracking-[0.18em] text-[var(--aivo-sensory-primary)] sm:inline">
              Teacher
            </span>
          </Link>

          <div className="ml-auto flex items-center gap-3">
            <span
              className="relative inline-flex h-9 w-9 items-center justify-center rounded-full text-iw-text-muted"
              aria-hidden="true"
            >
              <BellIcon className="h-5 w-5" />
              <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-[var(--aivo-color-status-error-default)]" />
            </span>
            <span className="hidden text-right sm:block">
              <span className="block text-sm font-semibold leading-tight text-iw-text-strong">
                {session.displayName}
              </span>
              <span className="block text-[11px] leading-tight text-iw-text-muted">{school}</span>
            </span>
            <Avatar name={session.displayName} size="md" />
          </div>
        </div>
      </header>

      <main id="main" className="mx-auto max-w-5xl px-4 py-6 sm:px-6">
        {children}
      </main>
    </div>
  );
}
