import React from "react";
import { Sparkles, ArrowRight, Star, Target, Shield, CheckCircle2 } from "lucide-react";
import "./_group.css";

export function Web() {
  return (
    <div className="brave-theme font-sans min-h-screen bg-[#f8fafe] text-[#041230] overflow-x-hidden">
      {/* Navigation */}
      <nav className="w-full px-6 py-4 flex items-center justify-between max-w-7xl mx-auto">
        <div className="font-display text-3xl font-black text-blue-600 tracking-tight">AIVO</div>
        <div className="hidden md:flex gap-8 font-bold text-sm">
          <a href="#" className="hover:text-blue-600">
            For Parents
          </a>
          <a href="#" className="hover:text-blue-600">
            For Schools
          </a>
          <a href="#" className="hover:text-blue-600">
            How it Works
          </a>
        </div>
        <div className="flex gap-4">
          <button className="px-6 py-2 font-bold hover:bg-gray-100 rounded-full transition-colors">
            Log In
          </button>
          <button className="brave-btn-primary px-6 py-2">Start Quest</button>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="px-6 py-20 max-w-7xl mx-auto grid md:grid-cols-2 gap-12 items-center">
        <div>
          <div className="inline-block px-4 py-2 bg-yellow-100 text-yellow-800 rounded-full font-bold text-sm mb-6 border-2 border-yellow-200">
            K-8 Adaptive Learning Platform
          </div>
          <h1 className="font-display text-6xl md:text-7xl font-black leading-[1.1] mb-6">
            Turn Learning Into An <span className="text-blue-600">Epic Quest</span>.
          </h1>
          <p className="text-xl font-medium opacity-80 mb-8 max-w-lg leading-relaxed">
            The neurodivergent-friendly learning app that adapts to how your child's brain works. 14
            specialized AI tutors, 5 functioning levels, infinite possibilities.
          </p>
          <div className="flex gap-4">
            <button className="brave-btn-primary text-xl px-8 py-4 flex items-center gap-2">
              Start Free Trial <ArrowRight className="w-6 h-6" />
            </button>
            <button className="brave-btn-secondary text-xl px-8 py-4">Watch Demo</button>
          </div>
          <div className="mt-8 flex items-center gap-4 text-sm font-bold opacity-70">
            <div className="flex -space-x-2">
              <div className="w-8 h-8 rounded-full bg-blue-200 border-2 border-white"></div>
              <div className="w-8 h-8 rounded-full bg-red-200 border-2 border-white"></div>
              <div className="w-8 h-8 rounded-full bg-green-200 border-2 border-white"></div>
            </div>
            Trusted by 10,000+ parents and schools
          </div>
        </div>
        <div className="relative">
          <div className="aspect-[4/3] rounded-[2rem] overflow-hidden border-8 border-white shadow-2xl bg-gray-100">
            <img
              src="/__mockup/images/brave-hero.png"
              alt="AIVO World"
              className="w-full h-full object-cover"
            />
          </div>
          <div
            className="absolute -bottom-6 -left-6 brave-card p-4 flex items-center gap-4 animate-bounce"
            style={{ animationDuration: "3s" }}
          >
            <div className="w-12 h-12 rounded-full bg-yellow-400 flex items-center justify-center text-white">
              <Star className="w-6 h-6 fill-current" />
            </div>
            <div>
              <div className="font-bold text-sm text-gray-500">New Badge</div>
              <div className="font-display font-bold text-lg">Math Master</div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Grid */}
      <section className="py-24 bg-white">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="font-display text-4xl font-black mb-4">Built for Different Brains</h2>
            <p className="text-lg font-medium opacity-70 max-w-2xl mx-auto">
              We don't force kids into a box. We build a box around them.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            <div className="brave-card p-8 bg-blue-50/50">
              <div className="w-14 h-14 rounded-2xl bg-blue-500 text-white flex items-center justify-center mb-6 shadow-lg transform rotate-3">
                <Target className="w-8 h-8" />
              </div>
              <h3 className="font-display text-2xl font-bold mb-3">Adaptive Levels</h3>
              <p className="font-medium opacity-80 leading-relaxed">
                From pre-symbolic communication to advanced middle school math, AIVO adjusts in
                real-time.
              </p>
            </div>
            <div className="brave-card p-8 bg-red-50/50">
              <div className="w-14 h-14 rounded-2xl bg-red-500 text-white flex items-center justify-center mb-6 shadow-lg transform -rotate-3">
                <Sparkles className="w-8 h-8" />
              </div>
              <h3 className="font-display text-2xl font-bold mb-3">14 AI Tutors</h3>
              <p className="font-medium opacity-80 leading-relaxed">
                Meet specialized companions that change their teaching style based on your child's
                needs.
              </p>
            </div>
            <div className="brave-card p-8 bg-yellow-50/50">
              <div className="w-14 h-14 rounded-2xl bg-yellow-400 text-yellow-900 flex items-center justify-center mb-6 shadow-lg transform rotate-3">
                <Shield className="w-8 h-8" />
              </div>
              <h3 className="font-display text-2xl font-bold mb-3">Sensory Safe</h3>
              <p className="font-medium opacity-80 leading-relaxed">
                No messy noise, flashing lights, or harsh sounds. Just clear, focused, joyful
                learning.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Proof / Testimonial */}
      <section className="py-24 bg-blue-600 text-white">
        <div className="max-w-7xl mx-auto px-6 text-center">
          <h2 className="font-display text-4xl md:text-5xl font-black mb-12">
            "Finally, an app that gets it."
          </h2>
          <div className="grid md:grid-cols-2 gap-8 max-w-4xl mx-auto">
            <div className="brave-card p-8 text-left text-gray-900">
              <div className="flex gap-1 text-yellow-400 mb-4">
                {[1, 2, 3, 4, 5].map((i) => (
                  <Star key={i} className="w-6 h-6 fill-current" />
                ))}
              </div>
              <p className="font-medium text-lg mb-6">
                "My autistic son used to cry during math homework. With AIVO's visual quests, he's
                actually asking to play it. The adaptive pacing is incredible."
              </p>
              <div className="font-bold">Sarah M.</div>
              <div className="text-sm opacity-60 font-medium">Parent of 2nd Grader</div>
            </div>
            <div className="brave-card p-8 text-left text-gray-900">
              <div className="flex gap-1 text-yellow-400 mb-4">
                {[1, 2, 3, 4, 5].map((i) => (
                  <Star key={i} className="w-6 h-6 fill-current" />
                ))}
              </div>
              <p className="font-medium text-lg mb-6">
                "As a special education teacher, finding tools that work across multiple functioning
                levels is rare. AIVO is a game-changer for my classroom."
              </p>
              <div className="font-bold">David L.</div>
              <div className="text-sm opacity-60 font-medium">Special Ed Teacher</div>
            </div>
          </div>
        </div>
      </section>

      {/* Footer CTA */}
      <section className="py-32 bg-[#f8fafe] text-center">
        <div className="max-w-3xl mx-auto px-6">
          <h2 className="font-display text-5xl font-black mb-6">Ready to start the adventure?</h2>
          <p className="text-xl font-medium opacity-80 mb-10">
            Join thousands of learners discovering the joy of tailored education.
          </p>
          <button className="brave-btn-primary text-2xl px-12 py-6">Create Free Account</button>
        </div>
      </section>
    </div>
  );
}
