"use client";
import Image from "next/image";
import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { ArrowRight, CheckCircle2, Flame, PauseCircle, PlayCircle, Sparkles } from "lucide-react";
import { trackCTAClick, trackSignupInitiation } from "@/lib/analytics";
import { WEB_APP_URL } from "@/lib/constants";

const TRUST_CITIES = ["Washington DC", "Chicago", "Minneapolis", "Dallas", "Atlanta", "Denver"];

type Slide = {
  src: string;
  alt: string;
  tutor: { name: string; subject: string; avatar: string };
};

const SLIDES: Slide[] = [
  {
    src: "/images/hero/arab-boy-chromebook.webp",
    alt: "A boy learning happily on a Chromebook with AIVO",
    tutor: { name: "Nova", subject: "Math", avatar: "/images/tutors/nova.png" },
  },
  {
    src: "/images/hero/girl-laptop.png",
    alt: "A focused young girl using AIVO on her laptop at home",
    tutor: { name: "Sage", subject: "Reading", avatar: "/images/tutors/sage.png" },
  },
  {
    src: "/images/hero/mother-son-sofa.webp",
    alt: "A mother and son learning together with AIVO on the sofa",
    tutor: { name: "Harmony", subject: "Speech", avatar: "/images/tutors/harmony.png" },
  },
  {
    src: "/images/hero/boy-tablet.png",
    alt: "A young boy with headphones working on a tablet with AIVO",
    tutor: { name: "Lingua", subject: "Spanish", avatar: "/images/tutors/lingua.png" },
  },
  {
    src: "/images/hero/girl-reading.png",
    alt: "A young girl reading and learning with AIVO at home",
    tutor: { name: "Muse", subject: "Writing", avatar: "/images/tutors/muse.png" },
  },
];

const SLIDE_INTERVAL_MS = 10000;

export function Hero({ scrollY }: Readonly<{ scrollY: number }>) {
  const t = useTranslations("marketing.hero");
  const [activeSlide, setActiveSlide] = useState(0);
  const [autoPlay, setAutoPlay] = useState(false);
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);

  useEffect(() => {
    if (typeof globalThis === "undefined" || !("matchMedia" in globalThis)) return;
    const mq = globalThis.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setPrefersReducedMotion(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);

  // Disable parallax on small screens / low-power devices to avoid jank
  const [parallaxEnabled, setParallaxEnabled] = useState(false);
  useEffect(() => {
    if (typeof globalThis === "undefined" || !("matchMedia" in globalThis)) return;
    const mq = globalThis.matchMedia(
      "(min-width: 768px) and (prefers-reduced-motion: no-preference)",
    );
    const update = () => setParallaxEnabled(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);

  useEffect(() => {
    if (!autoPlay || prefersReducedMotion) return;
    const id = globalThis.setInterval(() => {
      setActiveSlide((i) => (i + 1) % SLIDES.length);
    }, SLIDE_INTERVAL_MS);
    return () => globalThis.clearInterval(id);
  }, [autoPlay, prefersReducedMotion]);

  const STATS = [
    { value: "14", label: t("stat_tutors"), icon: "👨‍🏫" },
    { value: "5", label: t("stat_levels"), icon: "🎮" },
    { value: "10", label: t("stat_languages"), icon: "🌍" },
    { value: "24/7", label: t("stat_adaptive"), icon: "🧠" },
  ];

  const current = SLIDES[activeSlide];

  return (
    <section className="relative bg-white overflow-hidden">
      <div className="absolute inset-0 pointer-events-none -z-0">
        <div className="absolute top-10 -left-10 w-[40vw] h-[40vw] bg-purple-200 rounded-full blur-3xl opacity-60 animate-blob motion-reduce:animate-none" />
        <div
          className="absolute -bottom-10 -right-10 w-[35vw] h-[35vw] bg-[#ffe4dc] rounded-full blur-3xl animate-blob motion-reduce:animate-none"
          style={{ animationDelay: "4s" }}
        />
      </div>

      <div className="relative max-w-6xl mx-auto px-6 md:px-8 pt-16 pb-20 md:pt-24 md:pb-28">
        <div
          className="grid md:grid-cols-2 gap-12 items-center"
          style={{ transform: parallaxEnabled ? `translateY(${scrollY * -0.05}px)` : undefined }}
        >
          <div className="space-y-7 text-center md:text-left">
            <span className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-purple-100 text-purple-700 font-bold text-sm">
              <Sparkles className="w-4 h-4" aria-hidden="true" />
              {t("badge")}
            </span>
            <h1 className="text-5xl md:text-6xl lg:text-7xl font-heading font-bold text-slate-900 leading-[1.05] tracking-tight">
              {t("headline_line1")}
              <br />
              <span className="relative inline-block">
                <span
                  aria-hidden="true"
                  className="absolute inset-x-0 bottom-1 -z-10 h-[0.55em] rounded-sm bg-[#ffe4dc]"
                />
                <span className="relative text-slate-900">{t("headline_line2")}</span>
              </span>
            </h1>
            <p className="text-lg md:text-xl text-slate-600 font-body leading-relaxed max-w-xl mx-auto md:mx-0">
              {t("subheadline")}
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center md:justify-start pt-2">
              <a
                href={`${WEB_APP_URL}/signup?plan=free`}
                onClick={() => {
                  trackCTAClick("hero_start_trial", `${WEB_APP_URL}/signup?plan=free`);
                  trackSignupInitiation("hero");
                }}
                className="group inline-flex items-center justify-center gap-2 px-8 py-4 rounded-full bg-gradient-to-r from-primary to-primary-dark text-white font-bold text-lg hover:opacity-95 transition-all shadow-xl shadow-purple-200 hover:-translate-y-0.5 min-h-[44px]"
              >
                {t("cta_trial")}
                <ArrowRight
                  className="w-5 h-5 group-hover:translate-x-1 transition-transform"
                  aria-hidden="true"
                />
              </a>
              <a
                href="#brain"
                onClick={() => {
                  trackCTAClick("hero_watch_demo", "#brain");
                }}
                className="group inline-flex items-center justify-center gap-2 px-8 py-4 rounded-full border-2 border-slate-200 bg-white text-slate-700 font-bold text-lg hover:bg-slate-50 hover:border-slate-300 transition-all hover:-translate-y-0.5 min-h-[44px]"
              >
                <PlayCircle className="w-5 h-5 text-primary" aria-hidden="true" />
                {t("cta_demo")}
              </a>
            </div>
            <div className="flex flex-wrap items-center gap-x-5 gap-y-2 pt-2 justify-center md:justify-start text-sm font-bold text-slate-500">
              <span className="inline-flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-500" aria-hidden="true" />
                {t("trust_no_card")}
              </span>
              <span className="inline-flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-500" aria-hidden="true" />
                {t("trust_coppa")}
              </span>
              <span className="inline-flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-500" aria-hidden="true" />
                {t("trust_iep")}
              </span>
            </div>
          </div>

          <div
            className="relative w-full max-w-lg mx-auto md:max-w-none"
            onMouseEnter={() => setAutoPlay(false)}
          >
            <div
              aria-hidden="true"
              className="absolute -top-4 -right-4 z-20 bg-white p-4 rounded-2xl shadow-2xl border border-slate-100 rotate-3 animate-float-slow motion-reduce:animate-none"
              style={{ animationDelay: "0.5s" }}
            >
              <div className="flex items-center gap-3">
                <div className="bg-orange-100 text-orange-500 p-2 rounded-xl">
                  <Flame className="w-6 h-6 fill-current" aria-hidden="true" />
                </div>
                <div>
                  <p className="text-xs font-bold text-slate-500 uppercase tracking-wide">
                    {t("badge_streak")}
                  </p>
                  <p className="text-xl font-heading font-bold text-slate-800">
                    {t("badge_streak_value")}
                  </p>
                </div>
              </div>
            </div>
            <div
              aria-hidden="true"
              key={current.tutor.name}
              className="absolute -bottom-4 -left-4 z-20 bg-white p-3 pr-5 rounded-2xl shadow-2xl border border-slate-100 -rotate-3 animate-float-slow motion-reduce:animate-none flex items-center gap-3 transition-all duration-500"
            >
              <Image
                src={current.tutor.avatar}
                alt=""
                width={40}
                height={40}
                className="w-10 h-10 rounded-full object-cover bg-violet-100"
              />
              <div>
                <p className="text-xs font-bold text-slate-500 uppercase tracking-wide">
                  {t("badge_now_learning")}
                </p>
                <p className="text-sm font-heading font-bold text-slate-800">
                  {current.tutor.name} · {current.tutor.subject}
                </p>
              </div>
            </div>

            <div
              className="rounded-[2rem] overflow-hidden shadow-2xl border-4 border-white aspect-[4/5] md:aspect-[4/5] relative bg-slate-100"
              role="region"
              aria-roledescription="carousel"
              aria-label="Learners using AIVO"
            >
              <div className="absolute inset-0">
                <Image
                  key={current.src}
                  src={current.src}
                  alt={current.alt}
                  fill
                  className="object-cover"
                  sizes="(max-width: 768px) 100vw, 50vw"
                  priority={activeSlide === 0}
                />
              </div>

              <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-10 flex items-center gap-1 bg-black/30 backdrop-blur-sm rounded-full px-2 py-1">
                {SLIDES.map((slide, i) => (
                  <button
                    key={slide.src}
                    type="button"
                    onClick={() => {
                      setAutoPlay(false);
                      setActiveSlide(i);
                    }}
                    aria-label={`Show slide ${i + 1} of ${SLIDES.length}`}
                    aria-current={i === activeSlide}
                    className="inline-flex h-6 w-6 items-center justify-center"
                  >
                    <span
                      aria-hidden="true"
                      className={`block h-2 rounded-full transition-all ${i === activeSlide ? "w-6 bg-white" : "w-2 bg-white/60"}`}
                    />
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => setAutoPlay((value) => !value)}
                  aria-label={
                    autoPlay ? "Pause automatic slide rotation" : "Play automatic slide rotation"
                  }
                  aria-pressed={autoPlay}
                  className="ml-1 inline-flex items-center justify-center text-white/90 hover:text-white transition"
                >
                  {autoPlay ? (
                    <PauseCircle className="w-5 h-5" aria-hidden="true" />
                  ) : (
                    <PlayCircle className="w-5 h-5" aria-hidden="true" />
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="relative bg-white border-y border-slate-100">
        <div className="max-w-5xl mx-auto px-6 md:px-8 py-10 grid grid-cols-2 md:grid-cols-4 gap-6">
          {STATS.map((s) => (
            <div key={s.label} className="text-center">
              <div className="text-2xl mb-1">{s.icon}</div>
              <p className="text-3xl md:text-4xl font-heading font-bold text-primary">{s.value}</p>
              <p className="text-sm text-slate-500 font-bold mt-1">{s.label}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="relative bg-slate-50 border-b border-slate-100">
        <div className="max-w-6xl mx-auto px-6 md:px-8 py-5 flex flex-col md:flex-row items-center justify-between gap-4">
          <p className="text-sm text-slate-500 font-body">{t("trust_line")}</p>
          <div className="flex items-center gap-4 flex-wrap justify-center">
            {TRUST_CITIES.map((city) => (
              <span
                key={city}
                className="flex items-center gap-1.5 text-sm text-slate-500 font-body"
              >
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                {city}
              </span>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
