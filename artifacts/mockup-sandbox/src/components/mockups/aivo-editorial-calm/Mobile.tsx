import React from "react";
import { BookOpen, Map, Settings, Sparkles, User, ChevronRight, Play } from "lucide-react";
import "./_group.css";

export function Mobile() {
  return (
    <div className="aivo-editorial-calm min-h-[100dvh] w-full max-w-[390px] mx-auto bg-[#F9F8F6] relative overflow-hidden shadow-2xl ring-1 ring-border/20 flex flex-col">
      {/* Top Bar */}
      <header className="px-6 pt-14 pb-4 flex justify-between items-center bg-background/80 backdrop-blur-md sticky top-0 z-20">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-secondary overflow-hidden border border-border flex items-center justify-center">
            <img src="/__mockup/images/aivo-editorial-calm/feature-quiet.png" alt="Profile" className="w-full h-full object-cover opacity-80" />
          </div>
          <div>
            <h1 className="font-serif text-lg leading-none">Hello, Leo</h1>
            <span className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Level 3 Explorer</span>
          </div>
        </div>
        <button className="w-10 h-10 rounded-full flex items-center justify-center text-muted-foreground hover:bg-secondary transition-colors">
          <Settings className="w-5 h-5" />
        </button>
      </header>

      <main className="flex-grow px-6 py-6 space-y-8 overflow-y-auto pb-24">
        
        {/* Today's Focus */}
        <section>
          <div className="flex justify-between items-baseline mb-4">
            <h2 className="font-serif text-2xl font-light text-foreground">Today</h2>
            <span className="text-sm font-medium text-muted-foreground">Thursday, 12th</span>
          </div>
          
          <div className="rounded-3xl bg-white p-6 shadow-sm border border-border/40 relative overflow-hidden group">
            <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-full blur-3xl -mr-10 -mt-10"></div>
            
            <div className="flex items-center gap-3 mb-5 relative z-10">
              <div className="p-2 rounded-xl bg-primary/10 text-primary">
                <BookOpen className="w-5 h-5" />
              </div>
              <span className="font-medium text-sm tracking-wide text-foreground/80 uppercase">Current Focus</span>
            </div>
            
            <h3 className="font-serif text-2xl mb-2 relative z-10">Fractions & Sharing</h3>
            <p className="text-muted-foreground text-sm font-light leading-relaxed mb-8 max-w-[90%] relative z-10">
              We're continuing our work with visual fractions today. No rush, take your time.
            </p>
            
            <button className="w-full py-4 px-6 rounded-2xl bg-primary text-primary-foreground font-medium flex items-center justify-between shadow-sm active:scale-[0.98] transition-all relative z-10">
              <span className="text-base">Resume Session</span>
              <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center">
                <Play className="w-4 h-4 fill-current" />
              </div>
            </button>
          </div>
        </section>

        {/* Your Tutors */}
        <section>
          <h2 className="font-serif text-xl font-light text-foreground mb-4">Your Guides</h2>
          <div className="flex gap-4 overflow-x-auto pb-4 -mx-6 px-6 snap-x snap-mandatory hide-scrollbar">
            {[
              { name: "Prof. Oak", role: "Math", color: "bg-[#EAE4D3]", icon: <Sparkles className="w-4 h-4 text-[#8A795D]" /> },
              { name: "Aura", role: "Reading", color: "bg-[#DDE5E0]", icon: <BookOpen className="w-4 h-4 text-primary" /> },
              { name: "Nova", role: "Science", color: "bg-[#F0DFD8]", icon: <Map className="w-4 h-4 text-accent" /> },
            ].map((tutor, i) => (
              <div key={i} className="snap-start shrink-0 w-[140px] rounded-2xl bg-white border border-border/40 p-4 shadow-sm flex flex-col items-center text-center">
                <div className={`w-14 h-14 rounded-full ${tutor.color} mb-3 flex items-center justify-center`}>
                  {tutor.icon}
                </div>
                <h4 className="font-serif text-base">{tutor.name}</h4>
                <p className="text-xs text-muted-foreground mt-1">{tutor.role}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Progress Insight */}
        <section>
          <div className="rounded-2xl bg-secondary/40 p-5 border border-border/50 flex gap-4 items-start">
            <div className="w-10 h-10 rounded-full bg-white flex items-center justify-center shrink-0 shadow-sm border border-border/40">
              <Sparkles className="w-5 h-5 text-accent" />
            </div>
            <div>
              <h4 className="font-medium text-sm mb-1">Pacing Insight</h4>
              <p className="text-sm text-muted-foreground font-light leading-relaxed">
                You've been answering spatial questions 20% faster when we use visual models. We'll keep doing that.
              </p>
            </div>
          </div>
        </section>

      </main>

      {/* Bottom Nav */}
      <nav className="absolute bottom-0 left-0 right-0 bg-white/90 backdrop-blur-xl border-t border-border pb-safe pt-2 px-6 flex justify-around items-center h-20 z-20">
        <button className="flex flex-col items-center gap-1 p-2 text-primary">
          <BookOpen className="w-6 h-6" />
          <span className="text-[10px] font-medium">Learn</span>
        </button>
        <button className="flex flex-col items-center gap-1 p-2 text-muted-foreground hover:text-foreground transition-colors">
          <Map className="w-6 h-6" />
          <span className="text-[10px] font-medium">Map</span>
        </button>
        <button className="flex flex-col items-center gap-1 p-2 text-muted-foreground hover:text-foreground transition-colors">
          <User className="w-6 h-6" />
          <span className="text-[10px] font-medium">Profile</span>
        </button>
      </nav>
    </div>
  );
}
