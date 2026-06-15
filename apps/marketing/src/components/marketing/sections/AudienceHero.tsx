import type { ReactNode } from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Breadcrumbs, type Crumb } from "../Breadcrumbs";

interface CtaLink {
  label: string;
  href: string;
}

/**
 * Homepage-grade audience hero.
 *
 * Mirrors the construction of the home page hero (apps/marketing/src/app/page.tsx):
 * a max-w-6xl two-column layout with a gradient-emphasised keyword, soft brand
 * blobs, and a media slot on the right. The `visual` slot takes either real
 * photography or a product mock so each audience page can lead with the most
 * honest, most relevant proof.
 *
 * Server component (no client hooks) so audience pages stay pure RSC and ship
 * as static HTML for SEO.
 */
export function AudienceHero({
  badge,
  badgeColor,
  breadcrumbs,
  headlinePre,
  headlineEmph,
  subtitle,
  primary,
  secondary,
  visual,
}: {
  badge: string;
  badgeColor: string;
  breadcrumbs: Crumb[];
  headlinePre: string;
  headlineEmph?: string;
  subtitle: string;
  primary: CtaLink;
  secondary: CtaLink;
  visual: ReactNode;
}) {
  return (
    <section className="pt-10 pb-20 md:pt-14 md:pb-28 overflow-hidden relative" aria-labelledby="audience-hero-heading">
      <div
        className="absolute top-0 right-0 -translate-y-16 translate-x-1/4 w-[640px] h-[640px] rounded-full blur-3xl -z-10"
        style={{ backgroundColor: "rgba(124, 58, 237, 0.10)" }}
        aria-hidden="true"
      />
      <div
        className="absolute bottom-0 left-0 translate-y-1/3 -translate-x-1/3 w-[520px] h-[520px] rounded-full blur-3xl -z-10"
        style={{ backgroundColor: "rgba(59, 130, 246, 0.06)" }}
        aria-hidden="true"
      />

      <div className="max-w-6xl mx-auto px-6 md:px-8 grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
        <div className="max-w-2xl relative z-10">
          <Breadcrumbs items={breadcrumbs} />
          <span
            className="inline-block text-xs font-bold uppercase tracking-widest mb-5 px-3 py-1 rounded-full"
            style={{ color: badgeColor, backgroundColor: `${badgeColor}15` }}
          >
            {badge}
          </span>
          <h1
            id="audience-hero-heading"
            className="font-heading text-4xl md:text-6xl font-bold tracking-tight leading-[1.05] mb-6 text-slate-900"
          >
            {headlinePre}
            {headlineEmph ? (
              <>
                {" "}
                <span className="relative inline-block">
                  <span
                    className="relative z-10 bg-clip-text text-transparent"
                    style={{
                      backgroundImage:
                        "linear-gradient(135deg, var(--aivo-calmSky-500) 0%, var(--aivo-aivoPurple-400) 100%)",
                    }}
                  >
                    {headlineEmph}
                  </span>
                </span>
              </>
            ) : null}
          </h1>
          <p className="text-lg md:text-xl text-slate-600 mb-8 leading-relaxed font-medium">{subtitle}</p>
          <div className="flex flex-col sm:flex-row gap-3">
            <a
              href={primary.href}
              className="inline-flex items-center justify-center h-12 px-6 text-[15px] rounded-xl bg-[var(--aivo-sensory-primary)] hover:brightness-110 text-white font-semibold shadow-[0_6px_20px_-6px_rgba(124,58,237,0.45)] transition min-h-[44px]"
            >
              {primary.label}
              <ArrowRight className="ml-2 w-4 h-4" aria-hidden="true" />
            </a>
            <Link
              href={secondary.href}
              className="inline-flex items-center justify-center h-12 px-6 text-[15px] rounded-xl bg-white border border-slate-200 hover:border-slate-300 hover:bg-slate-50 text-slate-900 font-semibold transition min-h-[44px]"
            >
              {secondary.label}
            </Link>
          </div>
        </div>

        <div className="relative">{visual}</div>
      </div>
    </section>
  );
}
