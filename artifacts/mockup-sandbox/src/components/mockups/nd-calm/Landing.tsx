import React from "react";
import "./_group.css";
import { Button } from "@/components/ui/button";
import { CheckCircle2, Shield, BrainCircuit, Activity, Heart, ArrowRight } from "lucide-react";

export function Landing() {
  return (
    <div className="min-h-screen bg-[hsl(var(--background))] text-[hsl(var(--foreground))] font-sans font-normal selection:bg-slate-200">
      {/* Navigation */}
      <nav className="border-b border-slate-200 bg-white/80 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2 text-slate-700">
            <div className="w-6 h-6 bg-[hsl(var(--primary))] rounded-sm"></div>
            <span className="font-medium text-xl tracking-tight">AIVO</span>
          </div>
          <div className="hidden md:flex gap-8 text-sm font-medium text-slate-500">
            <a href="#how" className="hover:text-slate-800 transition-colors">How it works</a>
            <a href="#tutors" className="hover:text-slate-800 transition-colors">The 14 Tutors</a>
            <a href="#stories" className="hover:text-slate-800 transition-colors">Stories</a>
          </div>
          <div className="flex gap-4">
            <Button variant="ghost" className="text-slate-600 font-medium hidden sm:flex hover:bg-slate-50 border-slate-200">Log in</Button>
            <Button className="bg-[hsl(var(--primary))] hover:bg-[hsl(var(--primary)/0.9)] text-white font-medium">Start Free Month</Button>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="px-6 py-24 md:py-32 max-w-6xl mx-auto flex flex-col md:flex-row items-center gap-16">
        <div className="flex-1 space-y-8 text-center md:text-left">
          <h1 className="text-4xl md:text-5xl lg:text-6xl font-medium tracking-tight text-slate-800 leading-[1.1]">
            AI learning that adapts to how <span className="text-[hsl(var(--secondary))]">your child</span> learns.
          </h1>
          <p className="text-lg text-slate-600 max-w-xl mx-auto md:mx-0 leading-relaxed">
            A calm, predictable educational environment built specifically for neurodiverse minds. AIVO learns your child's unique sensory and cognitive profile to provide a tailored learning experience.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center md:justify-start">
            <Button className="bg-[hsl(var(--primary))] hover:bg-[hsl(var(--primary)/0.9)] text-white font-medium px-8 py-6 text-base h-auto">
              Start Free Month
            </Button>
            <Button variant="outline" className="border-slate-300 text-slate-600 font-medium px-8 py-6 text-base h-auto hover:bg-slate-50">
              Read the Research
            </Button>
          </div>
        </div>
        <div className="flex-1 w-full max-w-md md:max-w-none">
          <div className="aspect-square md:aspect-[4/3] rounded-2xl overflow-hidden border border-slate-200 bg-slate-100 flex items-center justify-center">
            {/* Placeholder for image */}
            <img src="/__mockup/images/nd-calm-hero.png" alt="A child learning peacefully with a tablet" className="w-full h-full object-cover" />
          </div>
        </div>
      </section>

      {/* Trust Strip */}
      <section className="border-y border-slate-200 bg-white">
        <div className="max-w-6xl mx-auto px-6 py-12 text-center space-y-6">
          <p className="text-sm font-medium text-slate-400 uppercase tracking-widest">Designed alongside specialists, trusted by parents</p>
          <div className="flex flex-wrap justify-center gap-8 md:gap-16 opacity-60 grayscale filter">
            <span className="font-semibold text-xl text-slate-600">Autism Research Institute</span>
            <span className="font-semibold text-xl text-slate-600">National Parent Assoc</span>
            <span className="font-semibold text-xl text-slate-600">InclusiveEd Alliance</span>
          </div>
        </div>
      </section>

      {/* Core Pillars */}
      <section className="px-6 py-24 bg-[hsl(var(--background))]">
        <div className="max-w-6xl mx-auto space-y-16">
          <div className="text-center space-y-4 max-w-2xl mx-auto">
            <h2 className="text-3xl md:text-4xl font-medium text-slate-800">A structured approach to individualized learning</h2>
            <p className="text-slate-600">We replace overwhelming interfaces with a quiet, purposeful system that meets your child exactly where they are.</p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            {[
              {
                icon: Shield,
                title: "14 Specialized Tutors",
                desc: "Instead of one generic AI, AIVO provides 14 distinct tutors, each with a specific subject and predictable personality. No surprises, just consistent support."
              },
              {
                icon: BrainCircuit,
                title: "Brain-Clone Personalization",
                desc: "The system continually adapts to how your child answers, creating a unique underlying model of their learning style to optimize pacing and presentation."
              },
              {
                icon: Activity,
                title: "Sensory & Functioning Levels",
                desc: "We adjust visual complexity, audio cues, and task difficulty based on 5 functioning levels and customizable sensory profiles to prevent overwhelm."
              }
            ].map((feature, i) => (
              <div key={i} className="bg-white border border-slate-200 p-8 rounded-xl space-y-4 text-center md:text-left">
                <div className="w-12 h-12 bg-slate-50 border border-slate-100 rounded-lg flex items-center justify-center mx-auto md:mx-0">
                  <feature.icon className="w-6 h-6 text-[hsl(var(--primary))]" />
                </div>
                <h3 className="text-xl font-medium text-slate-800">{feature.title}</h3>
                <p className="text-slate-600 text-sm leading-relaxed">{feature.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section id="how" className="border-t border-slate-200 bg-white px-6 py-24">
        <div className="max-w-6xl mx-auto flex flex-col lg:flex-row gap-16 items-center">
          <div className="flex-1 space-y-12">
            <div className="space-y-4">
              <h2 className="text-3xl md:text-4xl font-medium text-slate-800">Clear, predictable progress. Every day.</h2>
              <p className="text-slate-600">You remain in control of the learning journey while AIVO handles the specific educational pacing.</p>
            </div>
            
            <div className="space-y-8">
              {[
                { step: "01", title: "Set the Baseline", desc: "You configure the initial sensory preferences and functioning level." },
                { step: "02", title: "Match & Learn", desc: "Your child meets their assigned tutors in short, focused sessions." },
                { step: "03", title: "Daily Review", desc: "Review progress and adjust settings from your quiet parent dashboard." }
              ].map((item, i) => (
                <div key={i} className="flex gap-6">
                  <div className="text-lg font-medium text-slate-400 mt-1">{item.step}</div>
                  <div className="space-y-1">
                    <h3 className="text-lg font-medium text-slate-800">{item.title}</h3>
                    <p className="text-slate-600 text-sm">{item.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div className="flex-1 w-full bg-slate-50 border border-slate-200 rounded-xl p-8 aspect-square flex items-center justify-center">
            <div className="text-center space-y-4">
               <div className="w-16 h-16 bg-white border border-slate-200 rounded-full flex items-center justify-center mx-auto mb-4">
                 <CheckCircle2 className="w-8 h-8 text-slate-400" />
               </div>
               <p className="font-medium text-slate-600">Predictable routine visualization</p>
               <p className="text-sm text-slate-400">Minimalist interface representation</p>
            </div>
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section className="px-6 py-24 bg-[hsl(var(--background))] border-t border-slate-200">
        <div className="max-w-6xl mx-auto space-y-16">
          <div className="text-center max-w-2xl mx-auto">
            <h2 className="text-3xl font-medium text-slate-800">What parents are saying</h2>
          </div>
          
          <div className="grid md:grid-cols-2 gap-8">
            <div className="bg-white border border-slate-200 p-8 rounded-xl space-y-6">
              <p className="text-slate-600 leading-relaxed">
                "Other apps were too noisy and overstimulating. The reduced-motion setting and consistent layout of AIVO means my son actually focuses on the learning, not the interface. The tutors feel safe to him."
              </p>
              <div className="flex items-center gap-4 pt-4 border-t border-slate-100">
                <div className="w-10 h-10 bg-slate-200 rounded-full overflow-hidden">
                  <img src="/__mockup/images/nd-calm-testimonial-1.png" alt="Sarah" className="w-full h-full object-cover" />
                </div>
                <div>
                  <p className="font-medium text-sm text-slate-800">Sarah M.</p>
                  <p className="text-xs text-slate-500">Parent of a 7yo with ASD</p>
                </div>
              </div>
            </div>
            
            <div className="bg-white border border-slate-200 p-8 rounded-xl space-y-6">
              <p className="text-slate-600 leading-relaxed">
                "The parent dashboard is honest and clear. I don't get meaningless 'points' or gamification—I get actual updates on what cognitive skills the system is adapting to. It feels like a tool, not a toy."
              </p>
              <div className="flex items-center gap-4 pt-4 border-t border-slate-100">
                <div className="w-10 h-10 bg-slate-200 rounded-full overflow-hidden">
                  <img src="/__mockup/images/nd-calm-testimonial-2.png" alt="David" className="w-full h-full object-cover" />
                </div>
                <div>
                  <p className="font-medium text-sm text-slate-800">David K.</p>
                  <p className="text-xs text-slate-500">Parent of a 9yo with ADHD</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Pricing Teaser & Final CTA */}
      <section className="border-t border-slate-200 bg-white">
        <div className="max-w-4xl mx-auto px-6 py-24 text-center space-y-8">
          <Heart className="w-8 h-8 text-[hsl(var(--secondary))] mx-auto" />
          <h2 className="text-3xl md:text-4xl font-medium text-slate-800">Our Commitment to Accessibility</h2>
          <p className="text-slate-600 text-lg max-w-2xl mx-auto">
            AIVO is built strictly to WCAG AA standards. No unexpected sounds, no forced animations, clear contrast, and predictable navigation.
          </p>
          
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-8 max-w-md mx-auto mt-12 space-y-6">
            <h3 className="text-xl font-medium text-slate-800">Simple Monthly Access</h3>
            <p className="text-3xl font-medium text-slate-800">$29 <span className="text-base font-normal text-slate-500">/ month</span></p>
            <p className="text-sm text-slate-600">Cancel anytime. No hidden fees.</p>
            <Button className="bg-[hsl(var(--primary))] hover:bg-[hsl(var(--primary)/0.9)] text-white font-medium w-full py-6 text-base h-auto">
              Start Free First Month
            </Button>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-slate-200 bg-slate-50 px-6 py-12">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row justify-between items-center gap-6">
          <div className="flex items-center gap-2 text-slate-400">
            <div className="w-5 h-5 bg-slate-300 rounded-sm"></div>
            <span className="font-medium">AIVO</span>
          </div>
          <div className="flex gap-6 text-sm text-slate-500">
            <a href="#" className="hover:text-slate-800">Privacy Policy</a>
            <a href="#" className="hover:text-slate-800">Terms of Service</a>
            <a href="#" className="hover:text-slate-800">Accessibility Statement</a>
          </div>
          <p className="text-sm text-slate-400">© 2024 AIVO Learning. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}
