import Image from "next/image";
import Link from "next/link";
import {
  ArrowRight,
  Building2,
  CheckCircle2,
  LineChart,
  ShieldCheck,
  Star,
} from "lucide-react";
import { StickyHeader } from "@/components/marketing/StickyHeader";
import { Footer } from "@/components/marketing/Footer";
import { WEB_APP_URL } from "@/lib/constants";
import { getSensoryModeFromCookies } from "@/lib/sensory-mode.server";

/**
 * Home page — Inclusive Lab — Warm rollout.
 *
 * Ported 1:1 from the approved Web mockup at
 *   artifacts/mockup-sandbox/src/components/mockups/aivo-inclusive-warm/Web.tsx
 * with real production wiring:
 *   - Real photography for the hero (existing /images/hero/* slides).
 *   - Generated 3D companion (apps/marketing/public/images/companion/*).
 *     Falls back to the parent-child photo if a 3D asset isn't yet present.
 *   - Next.js Link + Image instead of <a>/<img>.
 *   - Header + Footer come from the shared StickyHeader/Footer so the rest
 *     of the marketing site inherits the same chrome.
 *
 * The hero copy is "Learning that adapts to your child." — the word
 * "adapts" sits inside nested spans for the gradient + underline effect,
 * so the literal substring "Learning that adapts" is not contiguous in
 * the SSR output. The production smoke check in
 * scripts/marketing-markers.sh therefore asserts the two halves on
 * either side of that span: "Learning that" and "to your child." If you
 * rename the headline, update both markers there.
 */
export default async function Home() {
  const sensoryMode = await getSensoryModeFromCookies();

  const heroFeatures = [
    {
      title: "14 Specialized AI Tutors",
      desc: "From highly-structured explicit instruction to open-ended exploratory dialog.",
    },
    {
      title: "5 Functioning Levels",
      desc: "Content complexity decoupled from interface complexity.",
    },
    {
      title: "Sensory-First Design",
      desc: "First-class controls for visual noise, contrast, and cognitive load.",
    },
  ];

  return (
    <div className="min-h-screen bg-[var(--aivo-color-surface-canvas,#fdf6ec)] text-slate-900">
      <StickyHeader initialSensoryMode={sensoryMode} />

      <main>
        {/* Hero */}
        <section className="pt-20 pb-24 md:pt-24 md:pb-32 overflow-hidden relative">
          <div
            className="absolute top-0 right-0 -translate-y-12 translate-x-1/3 w-[600px] h-[600px] rounded-full blur-3xl -z-10"
            style={{ backgroundColor: "rgba(255, 207, 159, 0.35)" }}
            aria-hidden="true"
          />
          <div
            className="absolute bottom-0 left-0 translate-y-1/3 -translate-x-1/4 w-[500px] h-[500px] rounded-full blur-3xl -z-10"
            style={{ backgroundColor: "rgba(124, 58, 237, 0.08)" }}
            aria-hidden="true"
          />

          <div className="max-w-6xl mx-auto px-6 md:px-8 grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
            <div className="max-w-2xl relative z-10">
              <span className="inline-flex items-center gap-2 mb-7 py-2 px-4 rounded-full border border-purple-200 bg-white/70 text-[var(--aivo-sensory-primary,#7c3aed)] font-semibold text-sm shadow-sm backdrop-blur">
                <ShieldCheck className="w-4 h-4" aria-hidden="true" />
                FERPA &amp; COPPA Compliant
              </span>
              <h1 className="font-heading text-4xl md:text-6xl font-bold tracking-tight leading-[1.05] mb-7 text-slate-900">
                Learning that{" "}
                <span className="relative inline-block px-2">
                  <span
                    className="relative z-10 bg-clip-text text-transparent"
                    style={{
                      backgroundImage: "linear-gradient(135deg, #3b82f6 0%, #a78bfa 100%)",
                    }}
                  >
                    adapts
                  </span>
                  <span
                    className="absolute bottom-1.5 left-0 w-full h-3 md:h-4 -rotate-2 rounded-lg -z-0"
                    style={{ backgroundColor: "rgba(196, 181, 253, 0.55)" }}
                    aria-hidden="true"
                  />
                </span>{" "}
                to your child.
              </h1>
              <p className="text-lg md:text-xl text-slate-600 mb-9 leading-relaxed font-medium">
                AIVO is the first AI learning platform engineered explicitly for neurodiverse
                cognitive profiles. We build a personalized &ldquo;brain-clone&rdquo; that models
                how your K-8 child learns best.
              </p>
              <div className="flex flex-col sm:flex-row gap-4">
                <a
                  href={`${WEB_APP_URL}/signup?plan=family`}
                  className="inline-flex items-center justify-center h-14 px-7 text-base rounded-full bg-[var(--aivo-sensory-primary,#7c3aed)] hover:opacity-90 text-white font-semibold shadow-lg shadow-purple-200 transition min-h-[44px]"
                >
                  Start Family Trial
                  <ArrowRight className="ml-2 w-5 h-5" aria-hidden="true" />
                </a>
                <Link
                  href="/for-districts"
                  className="inline-flex items-center justify-center h-14 px-7 text-base rounded-full bg-white/60 border border-purple-200 hover:bg-white text-[var(--aivo-sensory-primary,#7c3aed)] font-semibold transition min-h-[44px]"
                >
                  <Building2 className="w-5 h-5 mr-2" aria-hidden="true" />
                  For School Districts
                </Link>
              </div>
              <div className="mt-9 flex items-center gap-4 text-sm font-medium text-slate-600">
                <div className="flex -space-x-3" aria-hidden="true">
                  <div className="w-10 h-10 rounded-full border-2 border-white bg-[#dbeafe] flex items-center justify-center text-[#1e40af] font-bold text-xs">
                    S
                  </div>
                  <div className="w-10 h-10 rounded-full border-2 border-white bg-[#fef3c7] flex items-center justify-center text-[#92400e] font-bold text-xs">
                    M
                  </div>
                  <div className="w-10 h-10 rounded-full border-2 border-white bg-[#ede9fe] flex items-center justify-center text-[#5b21b6] font-bold text-xs">
                    J
                  </div>
                </div>
                <p>Trusted by 1,200+ specialists and parents.</p>
              </div>
            </div>

            <div className="relative">
              <div
                className="absolute inset-0 rounded-[2.5rem] -rotate-2 scale-105 -z-10"
                style={{ backgroundColor: "rgba(255, 207, 159, 0.4)" }}
                aria-hidden="true"
              />
              <Image
                src="/images/hero/girl-laptop.png"
                alt="A child smiling while learning on a laptop with AIVO"
                width={720}
                height={720}
                priority
                className="rounded-[2.5rem] shadow-2xl w-full object-cover border-4 border-white/60 rotate-1 transition-transform hover:rotate-0 duration-500 aspect-square"
              />

              {/* Floating stat card */}
              <div className="absolute -bottom-6 -left-4 md:-bottom-8 md:-left-8 w-64 md:w-72 rounded-3xl bg-white/95 backdrop-blur-md shadow-xl border border-white/60 p-5 flex items-start gap-4">
                <div className="w-12 h-12 rounded-2xl bg-[#dbeafe] flex items-center justify-center shrink-0">
                  <LineChart className="w-6 h-6 text-[#1d4ed8]" aria-hidden="true" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-slate-500 mb-1">Focus Duration</p>
                  <p className="text-2xl md:text-3xl font-bold tracking-tight text-[#1d4ed8]">
                    +47.2%
                  </p>
                  <p className="text-xs font-medium text-slate-500 mt-1">
                    Average increase week 1
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Research banner */}
        <section
          className="py-12 border-y border-slate-200/70 bg-white/40"
          aria-labelledby="research-heading"
        >
          <div className="max-w-6xl mx-auto px-6 md:px-8">
            <h2
              id="research-heading"
              className="text-center text-sm font-bold tracking-widest text-slate-500 uppercase mb-8"
            >
              Methodology Built on Research From
            </h2>
            <div className="flex flex-wrap justify-center gap-10 md:gap-20 opacity-60">
              <span className="font-serif text-xl md:text-2xl font-bold text-slate-700">
                Stanford University
              </span>
              <span className="font-serif text-xl md:text-2xl font-bold text-slate-700">
                MIT Media Lab
              </span>
              <span className="font-sans text-xl md:text-2xl font-black uppercase tracking-tighter text-slate-700">
                CAST
              </span>
              <span className="font-serif text-xl md:text-2xl font-bold italic text-slate-700">
                Johns Hopkins
              </span>
            </div>
          </div>
        </section>

        {/* Philosophy — Engineered for the margins */}
        <section className="py-24 md:py-32" id="features" aria-labelledby="philosophy-heading">
          <div className="max-w-6xl mx-auto px-6 md:px-8 grid md:grid-cols-2 gap-16 md:gap-20 items-center">
            <div className="relative order-2 md:order-1">
              <div
                className="absolute inset-0 rounded-[3rem] transform -rotate-3 scale-105 -z-10"
                style={{ backgroundColor: "rgba(255, 207, 159, 0.35)" }}
                aria-hidden="true"
              />
              <Image
                src="/images/hero/boy-tablet.png"
                alt="A child learning on a tablet with the AIVO interface"
                width={640}
                height={640}
                className="rounded-[2.5rem] shadow-xl w-full object-cover border-4 border-white aspect-square"
              />
            </div>
            <div className="order-1 md:order-2">
              <h2
                id="philosophy-heading"
                className="font-heading text-3xl md:text-5xl font-bold mb-8 leading-tight text-slate-900"
              >
                Engineered for the margins.
                <br />
                <span className="text-slate-500">Transformative for everyone.</span>
              </h2>
              <p className="text-lg md:text-xl text-slate-600 mb-10 leading-relaxed font-medium">
                Most EdTech builds for the &ldquo;average&rdquo; student and patches on
                accessibility later. We started with the most complex cognitive profiles — autism,
                ADHD, sensory processing differences — and built an engine that dynamically scales
                to any mind.
              </p>

              <ul className="space-y-7">
                {heroFeatures.map((feature) => (
                  <li key={feature.title} className="flex gap-5">
                    <div className="mt-1 bg-amber-100/70 p-3 rounded-2xl h-fit">
                      <CheckCircle2 className="w-6 h-6 text-amber-700" aria-hidden="true" />
                    </div>
                    <div>
                      <h3 className="font-heading font-bold text-xl mb-1 text-slate-900">
                        {feature.title}
                      </h3>
                      <p className="text-slate-600 font-medium">{feature.desc}</p>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>

        {/* Testimonials */}
        <section className="py-24 md:py-32 bg-white/50" aria-labelledby="testimonials-heading">
          <div className="max-w-6xl mx-auto px-6 md:px-8">
            <div className="flex flex-col items-center text-center mb-16 md:mb-20">
              <span className="mb-5 py-1.5 px-4 rounded-full bg-amber-100/70 text-amber-900 text-sm font-semibold">
                Family Evidence
              </span>
              <h2
                id="testimonials-heading"
                className="font-heading text-3xl md:text-5xl font-bold text-slate-900"
              >
                The relief of feeling{" "}
                <span className="relative inline-block px-1">
                  <span className="relative z-10">understood</span>
                  <span
                    className="absolute bottom-1 left-0 w-full h-3 rounded-lg -z-0"
                    style={{ backgroundColor: "rgba(255, 207, 159, 0.6)" }}
                    aria-hidden="true"
                  />
                </span>
                .
              </h2>
            </div>

            <div className="grid md:grid-cols-2 gap-8 md:gap-10 max-w-6xl mx-auto">
              <article className="bg-white border border-slate-200/60 shadow-lg rounded-[2.5rem] p-8 md:p-10">
                <div className="flex gap-1.5 mb-6" role="img" aria-label="5 star rating">
                  {[...Array(5)].map((_, i) => (
                    <Star
                      key={i}
                      className="w-5 h-5 fill-amber-400 text-amber-400"
                      aria-hidden="true"
                    />
                  ))}
                </div>
                <p className="text-lg md:text-xl mb-8 leading-relaxed font-medium text-slate-700">
                  &ldquo;My 8-year-old has profound ADHD and dyslexia. Every other app felt like
                  a slot machine — too loud, too fast. AIVO is the first platform that slows down
                  when he gets overwhelmed. It&apos;s not just a learning app, it&apos;s a
                  regulated environment.&rdquo;
                </p>
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 rounded-full bg-amber-100 flex items-center justify-center font-bold text-lg text-amber-800">
                    S.T.
                  </div>
                  <div>
                    <p className="font-bold text-lg text-slate-900">Sarah T.</p>
                    <p className="font-medium text-slate-500">Parent of 2</p>
                  </div>
                </div>
              </article>

              <article className="bg-white border border-slate-200/60 shadow-lg rounded-[2.5rem] p-8 md:p-10">
                <div className="flex gap-1.5 mb-6" role="img" aria-label="5 star rating">
                  {[...Array(5)].map((_, i) => (
                    <Star
                      key={i}
                      className="w-5 h-5 fill-amber-400 text-amber-400"
                      aria-hidden="true"
                    />
                  ))}
                </div>
                <p className="text-lg md:text-xl mb-8 leading-relaxed font-medium text-slate-700">
                  &ldquo;We use the &lsquo;Calm&rsquo; sensory mode exclusively. For an autistic
                  learner, removing the visual clutter isn&apos;t a nice-to-have, it&apos;s the
                  difference between learning and melting down. The data tracking for his IEP is
                  phenomenal.&rdquo;
                </p>
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 rounded-full bg-purple-100 flex items-center justify-center font-bold text-lg text-[var(--aivo-sensory-primary,#7c3aed)]">
                    M.R.
                  </div>
                  <div>
                    <p className="font-bold text-lg text-slate-900">Dr. Marcus R.</p>
                    <p className="font-medium text-slate-500">
                      Special Education Director &amp; Parent
                    </p>
                  </div>
                </div>
              </article>
            </div>
          </div>
        </section>

        {/* CTA card */}
        <section className="py-24 md:py-32" aria-labelledby="cta-heading">
          <div className="max-w-6xl mx-auto px-6 md:px-8">
            <div
              className="text-white shadow-2xl rounded-[2.5rem] md:rounded-[3rem] overflow-hidden border-0 relative"
              style={{ backgroundColor: "var(--aivo-sensory-primary, #7c3aed)" }}
            >
              <div
                className="absolute top-0 right-0 w-[600px] h-[600px] rounded-full blur-3xl -translate-y-1/2 translate-x-1/3"
                style={{ backgroundColor: "rgba(255, 255, 255, 0.1)" }}
                aria-hidden="true"
              />
              <div className="relative z-10 grid md:grid-cols-2">
                <div className="p-10 md:p-16 lg:p-20 flex flex-col justify-center">
                  <h2
                    id="cta-heading"
                    className="font-heading text-3xl md:text-5xl font-bold mb-6 leading-tight"
                  >
                    Ready to clone their brilliance?
                  </h2>
                  <p className="text-white mb-9 text-lg md:text-xl font-medium leading-relaxed">
                    Start with a comprehensive baseline assessment. No credit card required for
                    the first 14 days.
                  </p>
                  <div className="flex flex-col sm:flex-row gap-4">
                    <a
                      href={`${WEB_APP_URL}/signup?plan=family`}
                      className="inline-flex items-center justify-center h-14 bg-amber-300 text-amber-900 hover:bg-amber-200 rounded-full text-base font-bold shadow-lg px-7 min-h-[44px] transition"
                    >
                      Start Family Trial
                    </a>
                    <Link
                      href="/for-districts"
                      className="inline-flex items-center justify-center h-14 text-white border border-white/40 hover:bg-white/10 rounded-full text-base font-semibold px-7 min-h-[44px] transition"
                    >
                      Talk to District Sales
                    </Link>
                  </div>
                </div>
                <div className="hidden md:flex items-center justify-center p-12 lg:p-16 relative">
                  <Image
                    src="/images/hero/mother-son-sofa.webp"
                    alt="A parent and child learning together on a sofa"
                    width={560}
                    height={560}
                    className="w-full max-w-md object-cover drop-shadow-2xl rounded-[2rem] -rotate-3 aspect-square"
                  />
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}
