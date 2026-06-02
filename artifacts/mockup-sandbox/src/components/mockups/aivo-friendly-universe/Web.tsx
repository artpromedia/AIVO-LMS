import React from "react";
import "./_group.css";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Play, Sparkles, BookOpen, Heart, ArrowRight, ShieldCheck, Star } from "lucide-react";

export function Web() {
  return (
    <div className="min-h-screen w-full font-nunito text-[#334155] bg-[#F8FAFC] overflow-x-hidden selection:bg-[#FDE68A] selection:text-[#334155]">
      {/* Navbar */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-white/80 backdrop-blur-md border-b border-[#E2E8F0]/50">
        <div className="max-w-[1280px] mx-auto px-8 h-20 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-[#818CF8] text-white flex items-center justify-center shadow-sm">
              <Sparkles className="w-6 h-6" />
            </div>
            <span className="font-fredoka font-semibold text-3xl tracking-wide text-[#334155]">
              AIVO
            </span>
          </div>

          <div className="hidden md:flex items-center gap-8 font-semibold text-[#64748B]">
            <a href="#" className="hover:text-[#818CF8] transition-colors">
              For Parents
            </a>
            <a href="#" className="hover:text-[#818CF8] transition-colors">
              For Schools
            </a>
            <a href="#" className="hover:text-[#818CF8] transition-colors">
              The Science
            </a>
            <a href="#" className="hover:text-[#818CF8] transition-colors">
              Pricing
            </a>
          </div>

          <div className="flex items-center gap-4">
            <a
              href="#"
              className="font-semibold text-[#818CF8] hover:text-[#6366F1] transition-colors px-4 py-2"
            >
              Log in
            </a>
            <button className="font-fredoka bg-[#818CF8] hover:bg-[#6366F1] text-white px-6 py-2.5 rounded-full font-semibold transition-all friendly-soft-shadow hover:scale-105 active:scale-95 flex items-center gap-2">
              Start Free Trial
            </button>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative pt-32 pb-24 px-8 overflow-hidden min-h-[90vh] flex items-center">
        {/* Background blobs */}
        <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[60%] rounded-full bg-[#E0E7FF] blur-[120px] opacity-70 pointer-events-none" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[60%] h-[60%] rounded-full bg-[#FFEDD5] blur-[120px] opacity-60 pointer-events-none" />

        <div className="max-w-[1280px] mx-auto grid grid-cols-1 lg:grid-cols-2 gap-16 items-center relative z-10">
          <div className="max-w-xl">
            <div className="inline-flex items-center gap-2 bg-white/60 backdrop-blur-sm border border-[#E2E8F0] px-4 py-2 rounded-full mb-6 font-semibold text-sm text-[#818CF8]">
              <Sparkles className="w-4 h-4" />
              <span>A gentler way to learn</span>
            </div>
            <h1 className="font-fredoka text-5xl lg:text-7xl leading-[1.1] font-semibold text-[#334155] mb-6">
              Learning that{" "}
              <span className="text-[#818CF8] relative whitespace-nowrap">
                adapts
                <svg
                  className="absolute w-full h-3 -bottom-1 left-0 text-[#FDE68A]"
                  viewBox="0 0 100 10"
                  preserveAspectRatio="none"
                >
                  <path
                    d="M0 5 Q 50 10 100 5"
                    stroke="currentColor"
                    strokeWidth="4"
                    fill="transparent"
                    strokeLinecap="round"
                  />
                </svg>
              </span>{" "}
              to your child.
            </h1>
            <p className="text-xl text-[#64748B] mb-10 leading-relaxed font-medium">
              The first AI learning platform designed for neurodiverse kids. No flashing lights, no
              ticking clocks—just a patient companion that learns exactly how your child learns
              best.
            </p>
            <div className="flex flex-col sm:flex-row items-center gap-4">
              <button className="w-full sm:w-auto font-fredoka bg-[#818CF8] hover:bg-[#6366F1] text-white px-8 py-4 rounded-full text-lg font-semibold transition-all friendly-soft-shadow-md hover:-translate-y-1 flex items-center justify-center gap-2">
                Meet Your AIVO <ArrowRight className="w-5 h-5" />
              </button>
              <button className="w-full sm:w-auto font-fredoka bg-white hover:bg-[#F8FAFC] text-[#64748B] px-8 py-4 rounded-full text-lg font-semibold transition-all border-2 border-[#E2E8F0] flex items-center justify-center gap-2">
                <Play className="w-5 h-5 text-[#818CF8]" fill="currentColor" /> See How It Works
              </button>
            </div>
            <div className="mt-8 flex items-center gap-4 text-sm font-semibold text-[#94A3B8]">
              <div className="flex -space-x-2">
                {[1, 2, 3, 4].map((i) => (
                  <div
                    key={i}
                    className="w-8 h-8 rounded-full border-2 border-[#F8FAFC] bg-[#E2E8F0]"
                  />
                ))}
              </div>
              <p>Trusted by 10,000+ parents and schools</p>
            </div>
          </div>
          <div className="relative flex justify-center lg:justify-end">
            <div className="relative w-full max-w-[500px] aspect-square rounded-[3rem] bg-white border border-[#E2E8F0] p-6 friendly-soft-shadow-md overflow-hidden animate-float">
              <div className="absolute inset-0 bg-gradient-to-br from-[#E0E7FF]/50 to-[#FFEDD5]/50" />
              <img
                src="/__mockup/images/aivo-friendly/mascot.png"
                alt="AIVO Mascot"
                className="absolute inset-0 w-full h-full object-contain p-8"
              />

              <div className="absolute top-8 left-8 bg-white/90 backdrop-blur-sm rounded-2xl p-4 friendly-soft-shadow border border-[#E2E8F0] animate-float-delayed">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-[#C084FC]/20 flex items-center justify-center">
                    <Heart className="w-5 h-5 text-[#C084FC]" />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-[#64748B]">Empathy Engine</p>
                    <p className="text-sm font-bold text-[#334155]">Reading mood...</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Trust Section */}
      <section className="py-16 bg-white border-y border-[#E2E8F0]/50">
        <div className="max-w-[1280px] mx-auto px-8 text-center">
          <p className="text-sm font-bold tracking-widest text-[#94A3B8] uppercase mb-8">
            Developed with experts from
          </p>
          <div className="flex flex-wrap justify-center gap-12 opacity-50 grayscale mix-blend-multiply">
            <div className="text-2xl font-bold font-serif">Stanford Education</div>
            <div className="text-2xl font-bold font-serif">MIT Media Lab</div>
            <div className="text-2xl font-bold font-serif">Harvard Cognitive Science</div>
            <div className="text-2xl font-bold font-serif">Yale Center for Dyslexia</div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="py-32 px-8 relative">
        <div className="max-w-[1280px] mx-auto">
          <div className="text-center max-w-2xl mx-auto mb-20">
            <h2 className="font-fredoka text-4xl lg:text-5xl font-semibold text-[#334155] mb-6">
              A learning space that feels like a deep breath.
            </h2>
            <p className="text-xl text-[#64748B] font-medium">
              We stripped away the noise, the countdown timers, and the flashing rewards. What's
              left is a calm, focused environment where neurodiverse minds thrive.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            <div className="bg-white rounded-[2.5rem] p-8 border border-[#E2E8F0] friendly-soft-shadow hover:-translate-y-2 transition-transform duration-300">
              <div className="w-16 h-16 rounded-2xl bg-[#E0E7FF] flex items-center justify-center mb-6">
                <ShieldCheck className="w-8 h-8 text-[#818CF8]" />
              </div>
              <h3 className="font-fredoka text-2xl font-semibold mb-4 text-[#334155]">
                Sensory Safe
              </h3>
              <p className="text-[#64748B] leading-relaxed font-medium">
                Muted color palettes, gentle transitions, and zero unexpected loud noises. The
                interface adapts to your child's sensory needs in real-time.
              </p>
            </div>

            <div className="bg-white rounded-[2.5rem] p-8 border border-[#E2E8F0] friendly-soft-shadow hover:-translate-y-2 transition-transform duration-300">
              <div className="w-16 h-16 rounded-2xl bg-[#FFEDD5] flex items-center justify-center mb-6">
                <BookOpen className="w-8 h-8 text-[#F59E0B]" />
              </div>
              <h3 className="font-fredoka text-2xl font-semibold mb-4 text-[#334155]">
                Infinite Patience
              </h3>
              <p className="text-[#64748B] leading-relaxed font-medium">
                Our 14 specialized AI tutors never rush, never judge, and never get frustrated. They
                explain the same concept in 100 different ways until it clicks.
              </p>
            </div>

            <div className="bg-white rounded-[2.5rem] p-8 border border-[#E2E8F0] friendly-soft-shadow hover:-translate-y-2 transition-transform duration-300">
              <div className="w-16 h-16 rounded-2xl bg-[#F3E8FF] flex items-center justify-center mb-6">
                <Star className="w-8 h-8 text-[#C084FC]" />
              </div>
              <h3 className="font-fredoka text-2xl font-semibold mb-4 text-[#334155]">
                Strengths First
              </h3>
              <p className="text-[#64748B] leading-relaxed font-medium">
                We focus on what your child loves. If they're fascinated by trains, our tutors teach
                math, reading, and science entirely through the lens of trains.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Deep Dive Feature */}
      <section className="py-24 px-8 bg-white border-y border-[#E2E8F0]/50 relative overflow-hidden">
        <div className="max-w-[1280px] mx-auto grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
          <div className="order-2 lg:order-1 relative">
            <div className="relative w-full aspect-square rounded-[3rem] bg-[#F8FAFC] border border-[#E2E8F0] p-6 friendly-soft-shadow-md overflow-hidden">
              <img
                src="/__mockup/images/aivo-friendly/feature-1.png"
                alt="Feature illustration"
                className="absolute inset-0 w-full h-full object-cover"
              />
            </div>
          </div>
          <div className="order-1 lg:order-2">
            <Badge className="bg-[#E0E7FF] text-[#6366F1] hover:bg-[#E0E7FF] px-4 py-1.5 rounded-full text-sm mb-6 border-none">
              The Brain Clone
            </Badge>
            <h2 className="font-fredoka text-4xl lg:text-5xl font-semibold text-[#334155] mb-6">
              An AI that learns how your child learns.
            </h2>
            <p className="text-xl text-[#64748B] mb-8 leading-relaxed font-medium">
              Over the first 30 days, AIVO builds a comprehensive understanding of your child's
              cognitive profile—recognizing their working memory limits, attention span, and ideal
              challenge levels.
            </p>
            <ul className="space-y-4 mb-10">
              <li className="flex items-center gap-4 text-[#334155] font-semibold text-lg">
                <div className="w-8 h-8 rounded-full bg-[#818CF8]/20 flex items-center justify-center text-[#818CF8]">
                  <Sparkles className="w-4 h-4" />
                </div>
                Adapts to 5 different functioning levels
              </li>
              <li className="flex items-center gap-4 text-[#334155] font-semibold text-lg">
                <div className="w-8 h-8 rounded-full bg-[#818CF8]/20 flex items-center justify-center text-[#818CF8]">
                  <Sparkles className="w-4 h-4" />
                </div>
                Scaffolds complex tasks into tiny steps
              </li>
              <li className="flex items-center gap-4 text-[#334155] font-semibold text-lg">
                <div className="w-8 h-8 rounded-full bg-[#818CF8]/20 flex items-center justify-center text-[#818CF8]">
                  <Sparkles className="w-4 h-4" />
                </div>
                Generates daily parent progress reports
              </li>
            </ul>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-32 px-8 relative">
        <div className="absolute inset-0 bg-[#818CF8] opacity-5 pointer-events-none" />
        <div className="max-w-[800px] mx-auto text-center relative z-10">
          <h2 className="font-fredoka text-4xl lg:text-6xl font-semibold text-[#334155] mb-8">
            Ready to meet their new favorite tutor?
          </h2>
          <p className="text-xl text-[#64748B] mb-10 font-medium">
            Join thousands of families who have transformed homework time from a battleground into a
            moment of connection.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <button className="w-full sm:w-auto font-fredoka bg-[#818CF8] hover:bg-[#6366F1] text-white px-10 py-5 rounded-full text-xl font-semibold transition-all friendly-soft-shadow-md hover:scale-105 active:scale-95">
              Start Your Free Trial
            </button>
            <button className="w-full sm:w-auto font-fredoka bg-white hover:bg-[#F8FAFC] text-[#64748B] px-10 py-5 rounded-full text-xl font-semibold transition-all border-2 border-[#E2E8F0]">
              Talk to Sales (For Schools)
            </button>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-white border-t border-[#E2E8F0] py-16 px-8">
        <div className="max-w-[1280px] mx-auto flex flex-col md:flex-row justify-between items-center gap-8">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-[#818CF8] text-white flex items-center justify-center">
              <Sparkles className="w-4 h-4" />
            </div>
            <span className="font-fredoka font-semibold text-2xl text-[#334155]">AIVO</span>
          </div>
          <div className="flex items-center gap-8 text-sm font-semibold text-[#64748B]">
            <a href="#" className="hover:text-[#818CF8]">
              Privacy Policy
            </a>
            <a href="#" className="hover:text-[#818CF8]">
              Terms of Service
            </a>
            <a href="#" className="hover:text-[#818CF8]">
              Contact
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
