import {
  TrustStrip,
  HowItWorks,
  AudienceSelector,
  CoreProductLoop,
  TodaysMissionPreview,
  LessonRunPreview,
  RoleVisibility,
  FunctioningLevels,
  BrainClone,
  TutorCarousel,
  Testimonials,
  Pricing,
  FAQ as Faq,
  CTASection,
  Footer,
  TUTORS,
} from "@/components/marketing";
import { HomePageHeroShell } from "@/components/marketing/HomePageHeroShell";

export default function Home() {
  return (
    <div className="min-h-screen bg-white">
      <main>
        {/* MKT-05 §1 — Hero (preserves "Learning adventures" i18n marker) */}
        <HomePageHeroShell />

        {/* MKT-05 §2 — Audience selector */}
        <AudienceSelector />

        {/* MKT-05 §3 — How AIVO Works */}
        <HowItWorks />

        {/* MKT-05 §4 — Core product loop */}
        <CoreProductLoop />

        {/* MKT-05 §5 — Today's Mission preview */}
        <TodaysMissionPreview />

        {/* MKT-05 §6 — LessonRun preview */}
        <LessonRunPreview />

        {/* MKT-05 §7+§8 — Parent progress + Teacher visibility */}
        <RoleVisibility />

        {/* MKT-05 §9 — Support for diverse learning needs */}
        <div id="levels">
          <FunctioningLevels />
        </div>

        {/* Brand depth: Brain Clone + Tutor catalogue */}
        <div id="brain">
          <BrainClone />
        </div>
        <div id="tutors">
          <TutorCarousel tutors={TUTORS} />
        </div>

        {/* MKT-05 §10 — Trust, privacy, accessibility strip */}
        <TrustStrip />

        {/* Social proof */}
        <Testimonials />

        {/* MKT-05 §11 — Pricing / demo CTA */}
        <Pricing />

        {/* MKT-05 §12 — FAQ */}
        <div id="faq">
          <Faq />
        </div>

        {/* MKT-05 §13 — Final CTA */}
        <CTASection />
      </main>

      <Footer />
    </div>
  );
}
