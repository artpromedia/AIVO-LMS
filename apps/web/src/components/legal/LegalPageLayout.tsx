"use client";
import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";

interface Section {
  title: string;
  content: string | string[];
  list?: string[];
}

interface LegalPageLayoutProps {
  badge: string;
  title: string;
  subtitle: string;
  icon: ReactNode;
  accentColor: string;
  lastUpdated: string;
  sections: Section[];
  contactEmail?: string;
}

export function LegalPageLayout({
  badge,
  title,
  subtitle,
  icon,
  accentColor,
  lastUpdated,
  sections,
  contactEmail = "legal@aivolearning.com",
}: LegalPageLayoutProps) {
  return (
    <div className="min-h-screen bg-white">
      <header className="bg-white border-b border-slate-100 sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-6 md:px-8 py-3 flex items-center justify-between">
          <Link href="/" className="flex items-center">
            <Image
              src="/images/aivo-logo-purple.png"
              alt="AIVO"
              width={130}
              height={40}
              priority
              style={{ width: "auto", height: "auto" }}
            />
          </Link>
          <div className="flex items-center gap-3">
            <Link
              href="/login"
              className="px-5 py-2 rounded-lg text-slate-600 font-semibold hover:text-violet-600 transition hidden sm:inline-flex"
            >
              Sign In
            </Link>
            <Link
              href="/signup"
              className="px-5 py-2.5 rounded-full bg-violet-600 text-white font-bold hover:bg-violet-700 transition shadow-lg shadow-violet-200"
            >
              Get Started
            </Link>
          </div>
        </div>
      </header>

      <div
        className="relative overflow-hidden py-16 md:py-24"
        style={{
          background: `linear-gradient(135deg, ${accentColor}08 0%, ${accentColor}04 50%, #ffffff 100%)`,
        }}
      >
        <div className="absolute inset-0 pointer-events-none">
          <div
            className="absolute -top-20 -right-20 w-80 h-80 rounded-full blur-3xl opacity-20"
            style={{ backgroundColor: accentColor }}
          />
          <div
            className="absolute bottom-0 -left-20 w-60 h-60 rounded-full blur-3xl opacity-10"
            style={{ backgroundColor: accentColor }}
          />
        </div>
        <div className="max-w-4xl mx-auto px-6 md:px-8 relative z-10">
          <div className="flex items-center gap-3 mb-6">
            <div
              className="w-12 h-12 rounded-2xl flex items-center justify-center shadow-lg"
              style={{ backgroundColor: `${accentColor}15`, color: accentColor }}
            >
              {icon}
            </div>
            <span
              className="text-sm font-bold uppercase tracking-widest"
              style={{ color: accentColor }}
            >
              {badge}
            </span>
          </div>
          <h1 className="text-4xl md:text-5xl font-heading font-bold text-slate-900 mb-4 leading-tight">
            {title}
          </h1>
          <p className="text-lg text-slate-500 font-body max-w-2xl">
            {subtitle}
          </p>
          <p className="text-sm text-slate-400 font-body mt-4">
            Last updated: {lastUpdated}
          </p>
        </div>
      </div>

      <main className="max-w-4xl mx-auto px-6 md:px-8 py-12 md:py-16">
        <div className="space-y-10">
          {sections.map((section, i) => (
            <section key={i} className="scroll-mt-24" id={`section-${i + 1}`}>
              <h2 className="text-2xl font-heading font-bold text-slate-900 mb-4 flex items-center gap-3">
                <span
                  className="w-8 h-8 rounded-lg flex items-center justify-center text-sm font-bold text-white"
                  style={{ backgroundColor: accentColor }}
                >
                  {i + 1}
                </span>
                {section.title}
              </h2>
              {Array.isArray(section.content) ? (
                section.content.map((paragraph, pi) => (
                  <p
                    key={pi}
                    className="text-slate-600 font-body leading-relaxed mb-4"
                  >
                    {paragraph}
                  </p>
                ))
              ) : (
                <p className="text-slate-600 font-body leading-relaxed mb-4">
                  {section.content}
                </p>
              )}
              {section.list && (
                <ul className="space-y-2 mt-4">
                  {section.list.map((item, li) => (
                    <li
                      key={li}
                      className="flex items-start gap-3 text-slate-600 font-body"
                    >
                      <svg
                        className="w-5 h-5 mt-0.5 flex-shrink-0"
                        style={{ color: accentColor }}
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
                      {item}
                    </li>
                  ))}
                </ul>
              )}
            </section>
          ))}
        </div>

        <div
          className="mt-16 p-8 rounded-3xl border"
          style={{
            backgroundColor: `${accentColor}05`,
            borderColor: `${accentColor}20`,
          }}
        >
          <h3 className="text-xl font-heading font-bold text-slate-900 mb-2">
            Questions?
          </h3>
          <p className="text-slate-600 font-body mb-4">
            If you have any questions about this policy, please reach out to our team.
          </p>
          <a
            href={`mailto:${contactEmail}`}
            className="inline-flex items-center gap-2 px-6 py-3 rounded-full text-white font-bold transition hover:opacity-90 shadow-lg"
            style={{ backgroundColor: accentColor }}
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
            {contactEmail}
          </a>
        </div>
      </main>

      <footer className="bg-slate-900 py-8">
        <div className="max-w-6xl mx-auto px-6 md:px-8 flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-6">
            <Image
              src="/images/aivo-logo-white.png"
              alt="AIVO"
              width={100}
              height={30}
              style={{ width: "auto", height: "auto" }}
            />
            <nav className="hidden md:flex items-center gap-4">
              <Link href="/privacy-policy" className="text-sm text-slate-400 hover:text-white transition">Privacy</Link>
              <Link href="/terms-of-service" className="text-sm text-slate-400 hover:text-white transition">Terms</Link>
              <Link href="/coppa-compliance" className="text-sm text-slate-400 hover:text-white transition">COPPA</Link>
            </nav>
          </div>
          <p className="text-sm text-slate-500 font-body">
            &copy; {new Date().getFullYear()} AIVO Learning Platform
          </p>
        </div>
      </footer>
    </div>
  );
}
