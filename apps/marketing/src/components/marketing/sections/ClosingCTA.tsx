import Image from "next/image";
import Link from "next/link";

interface CtaLink {
  label: string;
  href: string;
}

/**
 * Gradient closing CTA — the same violet→indigo closer used on the home page,
 * extracted so every secondary page ends on the brand's signature note.
 *
 * Server component. Pass an optional image (rendered on the right, hidden on
 * small screens) for a warmer, human close.
 */
export function ClosingCTA({
  title,
  body,
  primary,
  secondary,
  imageSrc,
  imageAlt,
}: {
  title: string;
  body: string;
  primary: CtaLink;
  secondary: CtaLink;
  imageSrc?: string;
  imageAlt?: string;
}) {
  return (
    <section className="py-20 md:py-28" aria-labelledby="closing-cta-heading">
      <div className="max-w-6xl mx-auto px-6 md:px-8">
        <div className="text-white shadow-[0_30px_80px_-30px_rgba(76,29,149,0.45)] rounded-3xl md:rounded-[2rem] overflow-hidden border-0 relative bg-gradient-to-br from-[var(--aivo-sensory-primary)] to-indigo-800">
          <div
            className="absolute top-0 right-0 w-[600px] h-[600px] rounded-full blur-3xl -translate-y-1/2 translate-x-1/3"
            style={{ backgroundColor: "rgba(255, 255, 255, 0.10)" }}
            aria-hidden="true"
          />
          <div className="relative z-10 grid md:grid-cols-2">
            <div className="p-10 md:p-16 lg:p-20 flex flex-col justify-center">
              <h2
                id="closing-cta-heading"
                className="font-heading text-3xl md:text-5xl font-bold mb-6 leading-tight tracking-tight"
              >
                {title}
              </h2>
              <p className="text-white/85 mb-9 text-base md:text-lg font-medium leading-relaxed">{body}</p>
              <div className="flex flex-col sm:flex-row gap-3">
                <a
                  href={primary.href}
                  className="inline-flex items-center justify-center h-12 bg-white text-[var(--aivo-sensory-primary)] hover:bg-slate-50 rounded-xl text-[15px] font-bold px-6 min-h-[44px] transition"
                >
                  {primary.label}
                </a>
                <Link
                  href={secondary.href}
                  className="inline-flex items-center justify-center h-12 text-white border border-white/30 hover:bg-white/10 rounded-xl text-[15px] font-semibold px-6 min-h-[44px] transition"
                >
                  {secondary.label}
                </Link>
              </div>
            </div>
            {imageSrc && (
              <div className="hidden md:flex items-center justify-center p-12 lg:p-16 relative">
                <Image
                  src={imageSrc}
                  alt={imageAlt ?? ""}
                  width={560}
                  height={560}
                  className="w-full max-w-md object-cover rounded-2xl shadow-[0_30px_60px_-20px_rgba(0,0,0,0.4)] aspect-square"
                />
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
