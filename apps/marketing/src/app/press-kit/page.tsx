"use client";
import Image from "next/image";
import { CompanyPageLayout } from "@/components/marketing/legal/CompanyPageLayout";

const FACTS = [
  { label: "Founded", value: "2024" },
  { label: "Headquarters", value: "Washington, DC" },
  { label: "AI Tutors", value: "14" },
  { label: "Functioning Levels", value: "5" },
  { label: "Languages Supported", value: "10" },
  { label: "Target Ages", value: "5-17" },
];

export default function PressKitPage() {
  return (
    <CompanyPageLayout
      badge="Press Kit"
      breadcrumbSlug="press-kit"
      title="Media Resources"
      subtitle="Everything you need to tell the AIVO story. Download logos, read our fact sheet, and get in touch with our press team."
      icon="📰"
      accentColor="#d97706"
    >
      <section className="mb-16">
        <h2 className="text-2xl font-heading font-bold text-slate-900 mb-6">Company Overview</h2>
        <div className="bg-white rounded-2xl border border-slate-100 p-8">
          <p className="text-slate-600 font-body leading-relaxed mb-6">
            AIVO Learning is an AI-powered adaptive learning platform designed for students of all abilities, including those with autism, developmental differences, and diverse learning needs. Using proprietary Brain Clone technology, AIVO creates a unique learning profile for every student, adapting content, pace, and presentation in real-time across 14 specialized AI tutors and 5 functioning levels.
          </p>
          <p className="text-slate-600 font-body leading-relaxed">
            Founded by a team of healthcare executives, education experts, and technology leaders, AIVO is on a mission to ensure no learner is left behind. The platform serves both families (B2C) and school districts (B2B), with full COPPA, FERPA, and SOC 2 compliance.
          </p>
        </div>
      </section>

      <section className="mb-16">
        <h2 className="text-2xl font-heading font-bold text-slate-900 mb-6">Quick Facts</h2>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {FACTS.map((f) => (
            <div key={f.label} className="bg-amber-50/50 rounded-2xl border border-amber-100 p-5 text-center">
              <p className="text-2xl font-heading font-bold text-slate-900">{f.value}</p>
              <p className="text-sm text-slate-500 font-body mt-1">{f.label}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mb-16">
        <h2 className="text-2xl font-heading font-bold text-slate-900 mb-6">Brand Assets</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-white rounded-2xl border border-slate-100 p-8 flex flex-col items-center">
            <div className="bg-white rounded-xl p-6 mb-4 w-full flex items-center justify-center border border-slate-50">
              <Image src="/images/aivo-logo-purple.png" alt="AIVO Logo Purple" width={200} height={60} style={{ width: "auto", height: "auto" }} />
            </div>
            <p className="text-sm text-slate-500 font-body">Primary Logo (Purple)</p>
          </div>
          <div className="bg-slate-900 rounded-2xl border border-slate-700 p-8 flex flex-col items-center">
            <div className="rounded-xl p-6 mb-4 w-full flex items-center justify-center">
              <Image src="/images/aivo-logo-white.png" alt="AIVO Logo White" width={200} height={60} style={{ width: "auto", height: "auto" }} />
            </div>
            <p className="text-sm text-slate-400 font-body">Logo on Dark Background</p>
          </div>
        </div>
        <div className="mt-6 p-6 bg-slate-50 rounded-2xl border border-slate-100">
          <h3 className="font-heading font-bold text-slate-900 mb-3">Brand Colors</h3>
          <div className="flex flex-wrap gap-4">
            {[
              { name: "AIVO Purple", hex: "#7C3AED", textWhite: true },
              { name: "Deep Purple", hex: "#6D28D9", textWhite: true },
              { name: "Teal", hex: "#06B6D4", textWhite: true },
              { name: "Emerald", hex: "#10B981", textWhite: true },
              { name: "Amber", hex: "#F59E0B", textWhite: false },
              { name: "Slate 900", hex: "#0F172A", textWhite: true },
            ].map((c) => (
              <div key={c.hex} className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg shadow-sm border border-white/20" style={{ backgroundColor: c.hex }} />
                <div>
                  <p className="text-sm font-bold text-slate-900">{c.name}</p>
                  <p className="text-xs text-slate-400 font-mono">{c.hex}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section>
        <div className="bg-amber-50 rounded-3xl border border-amber-100 p-8 md:p-12">
          <h2 className="text-2xl font-heading font-bold text-slate-900 mb-4">Media Contact</h2>
          <p className="text-slate-600 font-body mb-6">
            For press inquiries, interview requests, or media resources, please reach out to our communications team.
          </p>
          <a
            href="mailto:press@aivolearning.com"
            className="inline-flex items-center gap-2 px-8 py-3.5 rounded-full bg-amber-600 text-white font-bold hover:bg-amber-700 transition shadow-lg"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
            press@aivolearning.com
          </a>
        </div>
      </section>
    </CompanyPageLayout>
  );
}
