import Link from "next/link";
import { ArrowRight, Building2, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { readMockSessionFromCookies } from "@/lib/auth/mock-session";
import { ROLE_HOME, ROLE_LABEL } from "@/lib/auth/types";
import { MascotCoach } from "@/components/playful-calm";
import { SiteHeader } from "@/components/marketing/site-header";
import { SiteFooter } from "@/components/marketing/site-footer";
import { HeroVisual } from "@/components/marketing/hero-visual";

export default async function Home() {
  const session = await readMockSessionFromCookies();

  return (
    <>
      <SiteHeader />
      <main id="main" className="mx-auto max-w-6xl px-6 pb-16 pt-6 sm:pt-10">
        <section className="grid items-center gap-12 lg:grid-cols-[1.05fr_1fr] lg:gap-16">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-iw-border bg-iw-card px-4 py-1.5 text-iw-primary shadow-soft-1">
              <ShieldCheck className="h-4 w-4" aria-hidden="true" />
              <span className="text-sm font-bold tracking-wide">FERPA &amp; COPPA Compliant</span>
            </div>
            <h1 className="mt-6 font-iw-display text-5xl font-bold leading-[1.05] tracking-tight text-iw-ink sm:text-6xl lg:text-7xl">
              Learning that{" "}
              <span className="relative inline-block">
                <span
                  aria-hidden="true"
                  className="absolute inset-x-0 bottom-1 -z-10 h-[0.55em] rounded-sm bg-iw-warm-soft"
                />
                <span className="relative text-iw-ink">adapts</span>
              </span>{" "}
              to your child.
            </h1>
            <p className="mt-6 max-w-xl text-lg leading-relaxed text-iw-ink-muted sm:text-xl">
              AIVO is the first AI learning platform engineered explicitly for neurodiverse
              cognitive profiles. We build a personalised &ldquo;brain-clone&rdquo; that models
              how your K&ndash;8 child learns best.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              {session ? (
                <>
                  <Button asChild size="lg">
                    <Link href={ROLE_HOME[session.role]} className="group">
                      Continue as {ROLE_LABEL[session.role]}
                      <ArrowRight
                        className="h-5 w-5 transition-transform group-hover:translate-x-1"
                        aria-hidden="true"
                      />
                    </Link>
                  </Button>
                  <Button asChild size="lg" variant="outline">
                    <Link href="/login">Switch role</Link>
                  </Button>
                </>
              ) : (
                <>
                  <Button asChild size="lg">
                    <Link href="/signup" className="group">
                      Start Family Trial
                      <ArrowRight
                        className="h-5 w-5 transition-transform group-hover:translate-x-1"
                        aria-hidden="true"
                      />
                    </Link>
                  </Button>
                  <Button asChild size="lg" variant="outline">
                    <Link href="/admin/district">
                      <Building2 className="h-5 w-5" aria-hidden="true" />
                      For School Districts
                    </Link>
                  </Button>
                </>
              )}
            </div>
            {/* Quiet social-proof line. The previous decorative monogram
                cluster (S / M / J pills) competed with the CTAs for
                attention without conveying meaningful information. */}
            <p className="mt-8 text-sm text-iw-ink-muted">
              Trusted by 1,200+ specialists and parents.
            </p>
          </div>

          <div className="hidden lg:block">
            <HeroVisual />
          </div>
        </section>
        <MascotCoach
          name="Your tutor companion"
          tip="One primary action per screen helps young learners stay focused."
        />
      </main>
      <SiteFooter />
    </>
  );
}
