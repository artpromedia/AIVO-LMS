"use client";
import Image from "next/image";
import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { trackCTAClick, trackSignupInitiation } from "@/lib/analytics";
import { WEB_APP_URL } from "@/lib/constants";

export interface Tutor {
  name: string;
  domain: string;
  color: string;
  bg: string;
  tagline: string;
  bullets: string[];
  img: string;
}

export function TutorCarousel({ tutors }: { tutors: Tutor[] }) {
  const t = useTranslations("marketing.tutor_carousel");
  const [activeTutor, setActiveTutor] = useState(0);
  const [isAutoPlaying, setIsAutoPlaying] = useState(true);
  const resumeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!isAutoPlaying) return;
    const timer = setInterval(() => {
      setActiveTutor((prev) => (prev + 1) % tutors.length);
    }, 5000);
    return () => clearInterval(timer);
  }, [isAutoPlaying, tutors.length]);

  useEffect(() => {
    return () => {
      if (resumeTimerRef.current) clearTimeout(resumeTimerRef.current);
    };
  }, []);

  const goTo = useCallback((index: number) => {
    setActiveTutor(index);
    setIsAutoPlaying(false);
    if (resumeTimerRef.current) clearTimeout(resumeTimerRef.current);
    resumeTimerRef.current = setTimeout(() => setIsAutoPlaying(true), 15000);
  }, []);

  const toggleAutoPlay = useCallback(() => {
    if (resumeTimerRef.current) clearTimeout(resumeTimerRef.current);
    setIsAutoPlaying((prev) => !prev);
  }, []);

  const goPrev = useCallback(() => {
    goTo((activeTutor - 1 + tutors.length) % tutors.length);
  }, [activeTutor, goTo, tutors.length]);

  const goNext = useCallback(() => {
    goTo((activeTutor + 1) % tutors.length);
  }, [activeTutor, goTo, tutors.length]);

  const getOffset = (index: number) => {
    const diff = index - activeTutor;
    const len = tutors.length;
    if (diff === 0) return 0;
    if (diff === 1 || diff === -(len - 1)) return 1;
    if (diff === -1 || diff === len - 1) return -1;
    if (diff === 2 || diff === -(len - 2)) return 2;
    if (diff === -2 || diff === len - 2) return -2;
    return diff > 0 ? 3 : -3;
  };

  const current = tutors[activeTutor];

  return (
    <section
      className="relative py-24 overflow-hidden"
      style={{
        background: "linear-gradient(180deg, #f0fdf4 0%, #ecfdf5 30%, #f0f9ff 70%, #f8fafc 100%)",
      }}
    >
      <div className="max-w-6xl mx-auto px-6 md:px-8">
        <div className="text-center mb-16">
          <p className="text-sm font-bold text-emerald-600 uppercase tracking-widest mb-3">
            {t("label")}
          </p>
          <h2 className="text-4xl md:text-5xl font-heading font-bold text-slate-900 mb-4">
            {t("title")}
          </h2>
          <p className="text-lg text-slate-500 max-w-2xl mx-auto font-body">{t("subtitle")}</p>
        </div>

        <div className="relative h-[520px] md:h-[560px]">
          <button
            onClick={goPrev}
            className="absolute left-0 md:left-4 top-1/2 -translate-y-1/2 z-30 w-12 h-12 rounded-full bg-white/90 shadow-lg flex items-center justify-center hover:bg-white hover:scale-110 transition-all"
            aria-label={t("prev_tutor")}
          >
            <svg
              className="w-6 h-6 text-slate-600"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M15 19l-7-7 7-7"
              />
            </svg>
          </button>
          <button
            onClick={goNext}
            className="absolute right-0 md:right-4 top-1/2 -translate-y-1/2 z-30 w-12 h-12 rounded-full bg-white/90 shadow-lg flex items-center justify-center hover:bg-white hover:scale-110 transition-all"
            aria-label={t("next_tutor")}
          >
            <svg
              className="w-6 h-6 text-slate-600"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>

          <div className="relative w-full h-full flex items-center justify-center">
            {tutors.map((tutor, index) => {
              const offset = getOffset(index);
              const isCenter = offset === 0;
              const isAdjacent = Math.abs(offset) === 1;
              const isHidden = Math.abs(offset) >= 3;
              if (isHidden) return null;

              const translateX = isCenter ? 0 : offset * (isAdjacent ? 280 : 420);
              const scale = isCenter ? 1 : isAdjacent ? 0.75 : 0.55;
              const zIndex = isCenter ? 20 : isAdjacent ? 10 : 5;
              const opacity = isCenter ? 1 : isAdjacent ? 0.7 : 0.4;

              return (
                <button
                  key={tutor.name}
                  onClick={() => !isCenter && goTo(index)}
                  className="absolute transition-all duration-700 ease-in-out focus:outline-none focus-visible:ring-4 focus-visible:ring-purple-300 rounded-3xl"
                  style={{
                    transform: `translateX(${translateX}px) scale(${scale})`,
                    zIndex,
                    opacity,
                    cursor: isCenter ? "default" : "pointer",
                  }}
                  aria-label={
                    isCenter
                      ? t("currently_selected", { name: tutor.name, domain: tutor.domain })
                      : t("view_tutor", { name: tutor.name, domain: tutor.domain })
                  }
                  tabIndex={isCenter ? -1 : 0}
                >
                  <div
                    className={`w-[260px] rounded-3xl overflow-hidden shadow-2xl bg-gradient-to-br ${tutor.bg}`}
                    style={{ transformStyle: "preserve-3d" }}
                  >
                    <div className="relative h-[340px] overflow-hidden">
                      <Image
                        src={tutor.img}
                        alt={`${tutor.name} - ${tutor.domain} tutor`}
                        fill
                        className="object-cover object-top"
                        sizes="260px"
                        priority={isCenter}
                        loading={isCenter ? "eager" : "lazy"}
                      />
                      <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent p-4 text-left">
                        <p className="text-white font-heading font-bold text-xl">{tutor.name}</p>
                        <p className="text-white/80 text-sm">{tutor.domain}</p>
                      </div>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>

          <div className="hidden md:block absolute right-0 top-1/2 -translate-y-1/2 w-[340px] z-[25] pointer-events-none">
            <div className="bg-white/95 backdrop-blur-sm rounded-2xl p-8 shadow-xl border border-slate-100 pointer-events-auto">
              <p
                className="text-sm font-semibold uppercase tracking-wider mb-1"
                style={{ color: current.color }}
              >
                {current.domain}
              </p>
              <h3 className="text-3xl font-heading font-bold text-slate-900 mb-2">
                {current.name}
              </h3>
              <p className="text-base italic mb-4" style={{ color: current.color }}>
                {current.tagline}
              </p>
              <ul className="space-y-3 mb-6">
                {current.bullets.map((b) => (
                  <li key={b} className="flex items-start gap-2 text-sm text-slate-600">
                    <svg
                      className="w-4 h-4 mt-0.5 flex-shrink-0"
                      style={{ color: current.color }}
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M5 13l4 4L19 7"
                      />
                    </svg>
                    {b}
                  </li>
                ))}
              </ul>
              <a
                href={`${WEB_APP_URL}/signup?plan=free`}
                onClick={() => {
                  trackCTAClick("tutor_learn_with", `${WEB_APP_URL}/signup?plan=free`);
                  trackSignupInitiation("tutor_carousel");
                }}
                className="block w-full py-3 rounded-full text-white font-bold transition hover:opacity-90 shadow-lg text-center"
                style={{ backgroundColor: current.color }}
              >
                {t("learn_with", { name: current.name })}
              </a>
            </div>
          </div>

          <div className="md:hidden absolute bottom-0 left-0 right-0 z-[25]">
            <div className="bg-white/95 backdrop-blur-sm rounded-t-2xl p-6 shadow-xl border-t border-slate-100">
              <div className="flex items-center justify-between mb-2">
                <div>
                  <p
                    className="text-xs font-semibold uppercase tracking-wider"
                    style={{ color: current.color }}
                  >
                    {current.domain}
                  </p>
                  <h3 className="text-xl font-heading font-bold text-slate-900">{current.name}</h3>
                </div>
                <a
                  href={`${WEB_APP_URL}/signup?plan=free`}
                  onClick={() => {
                    trackCTAClick("tutor_learn_mobile", `${WEB_APP_URL}/signup?plan=free`);
                    trackSignupInitiation("tutor_carousel_mobile");
                  }}
                  className="px-4 py-2 rounded-full text-white text-sm font-bold"
                  style={{ backgroundColor: current.color }}
                >
                  {t("learn")}
                </a>
              </div>
              <p className="text-sm italic" style={{ color: current.color }}>
                {current.tagline}
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-center gap-2 mt-8">
          <button
            onClick={toggleAutoPlay}
            className="w-8 h-8 rounded-full bg-white shadow-md flex items-center justify-center hover:bg-slate-50 transition mr-2"
            aria-label={isAutoPlaying ? t("pause_carousel") : t("play_carousel")}
          >
            {isAutoPlaying ? (
              <svg className="w-4 h-4 text-slate-600" fill="currentColor" viewBox="0 0 24 24">
                <rect x="6" y="4" width="4" height="16" />
                <rect x="14" y="4" width="4" height="16" />
              </svg>
            ) : (
              <svg className="w-4 h-4 text-slate-600" fill="currentColor" viewBox="0 0 24 24">
                <path d="M8 5v14l11-7z" />
              </svg>
            )}
          </button>
          {tutors.map((tutor, i) => (
            <button
              key={tutor.name}
              onClick={() => goTo(i)}
              className="w-3 h-3 rounded-full transition-all duration-300"
              style={{
                backgroundColor: i === activeTutor ? tutor.color : "#CBD5E1",
                transform: i === activeTutor ? "scale(1.3)" : "scale(1)",
              }}
              aria-label={t("go_to", { name: tutor.name })}
            />
          ))}
        </div>
      </div>
    </section>
  );
}
