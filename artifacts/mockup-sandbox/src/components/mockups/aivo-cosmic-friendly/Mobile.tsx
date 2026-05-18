import React from "react";
import { Button } from "@/components/ui/button";
import { 
  Sparkles, Compass, User, BookOpen, Star, 
  Map as MapIcon, ChevronRight, Award, Zap, 
  Settings, Battery
} from "lucide-react";
import "./_group.css";

export function Mobile() {
  return (
    <div className="cosmic-friendly min-h-[100dvh] w-full max-w-[390px] mx-auto overflow-hidden flex flex-col font-sans bg-background relative shadow-[0_0_50px_rgba(0,0,0,0.1)] rounded-[2.5rem] border-[6px] border-gray-900 ring-1 ring-border">
      
      {/* Dynamic Background Dawn Gradient */}
      <div className="absolute inset-0 bg-dawn-sky-mobile opacity-10 pointer-events-none"></div>

      {/* Decorative stars */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="glowing-star top-[15%] left-[20%] animate-pulse-soft bg-primary"></div>
        <div className="glowing-star top-[25%] right-[15%] opacity-40 bg-accent"></div>
        <div className="glowing-star top-[40%] left-[10%] animate-pulse-soft bg-secondary" style={{animationDelay: '1s'}}></div>
      </div>
      
      {/* Status Bar Mock */}
      <div className="w-full h-12 flex items-end justify-between px-6 pb-2 text-xs font-semibold text-foreground/70 z-50 pt-2">
        <span>9:41</span>
        <div className="flex items-center gap-1.5">
          <Battery className="w-5 h-5 text-foreground/70" />
        </div>
      </div>

      {/* Header */}
      <header className="px-6 pt-4 pb-4 relative z-10 flex justify-between items-center">
        <div>
          <h1 className="font-display font-bold text-3xl text-foreground tracking-tight">Hi, Leo!</h1>
          <p className="text-primary text-sm font-bold flex items-center gap-1.5 mt-1">
            <Sparkles className="w-4 h-4" /> Level 4 Explorer
          </p>
        </div>
        <div className="w-14 h-14 rounded-full bg-white shadow-lg border-2 border-primary/20 p-1 relative cursor-pointer active:scale-95 transition-transform">
          <img 
            src="/__mockup/images/aivo-cosmic-friendly/mobile-avatar.png" 
            alt="Avatar" 
            className="w-full h-full rounded-full object-cover bg-muted"
          />
          <div className="absolute -bottom-1 -right-1 w-6 h-6 bg-secondary rounded-full flex items-center justify-center border-2 border-white shadow-sm">
            <span className="text-[10px] font-bold text-white">12</span>
          </div>
        </div>
      </header>

      {/* Scrollable Content */}
      <div className="flex-1 overflow-y-auto px-6 pb-28 scrollbar-hide z-10">
        
        {/* Today's Journey */}
        <div className="mt-2 mb-8">
          <h2 className="font-display text-[13px] font-bold text-muted-foreground uppercase tracking-widest mb-3">Today's Constellation</h2>
          
          <div className="bg-white border border-border/60 soft-shadow p-6 rounded-[2rem] relative overflow-hidden cursor-pointer active:scale-[0.98] transition-transform">
            {/* Soft decorative blob */}
            <div className="absolute -right-8 -top-8 w-32 h-32 bg-primary/10 rounded-full blur-2xl"></div>
            
            <div className="flex justify-between items-start mb-6 relative z-10">
              <div>
                <span className="inline-flex items-center rounded-full bg-primary/10 text-primary font-bold px-3 py-1 text-xs mb-3 border border-primary/20">
                  Next Mission
                </span>
                <h3 className="font-display font-bold text-2xl text-foreground leading-tight">Numbers in Space</h3>
                <p className="text-muted-foreground text-sm font-medium mt-1">Math • 10 mins</p>
              </div>
              <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center">
                <Compass className="w-6 h-6 text-primary" />
              </div>
            </div>
            
            {/* Gentle Progress Bar */}
            <div className="w-full h-3 bg-muted rounded-full overflow-hidden mb-4 border border-border/50">
              <div className="h-full bg-gradient-to-r from-primary to-accent w-[40%] rounded-full relative">
                <div className="absolute inset-0 bg-white/20" />
              </div>
            </div>
            
            <Button className="w-full font-display font-bold bg-primary hover:bg-primary/90 text-white h-14 rounded-2xl text-lg shadow-lg shadow-primary/20 border-none transition-transform">
              Start Exploring
            </Button>
          </div>
        </div>

        {/* Tutors Carousel */}
        <div className="mb-8">
          <div className="flex justify-between items-end mb-3">
            <h2 className="font-display text-[13px] font-bold text-muted-foreground uppercase tracking-widest">Your Guides</h2>
            <span className="text-xs text-primary font-bold">View All</span>
          </div>
          
          <div className="flex gap-4 overflow-x-auto pb-4 scrollbar-hide -mx-6 px-6">
            {[
              { name: "Nova", role: "Reading", color: "text-primary", bg: "bg-primary/10" },
              { name: "Orion", role: "Emotions", color: "text-[#F59E0B]", bg: "bg-[#FFEDD5]" },
              { name: "Lyra", role: "Focus", color: "text-accent", bg: "bg-accent/20" },
            ].map((tutor, i) => (
              <div key={i} className="flex-shrink-0 w-28 rounded-3xl bg-white border border-border/50 soft-shadow p-5 flex flex-col items-center justify-center text-center animate-float" style={{animationDelay: `${i * 0.5}s`}}>
                <div className={`w-14 h-14 rounded-[1.25rem] ${tutor.bg} flex items-center justify-center mb-3`}>
                  <Star className={`w-7 h-7 ${tutor.color}`} fill="currentColor" />
                </div>
                <h4 className="font-display font-bold text-foreground text-base">{tutor.name}</h4>
                <p className="text-xs font-medium text-muted-foreground mt-0.5">{tutor.role}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Recent Discoveries */}
        <div>
          <h2 className="font-display text-[13px] font-bold text-muted-foreground uppercase tracking-widest mb-3">Discoveries</h2>
          <div className="space-y-3">
            {[
              { title: "Quiet Focus", desc: "Completed a 5-min calming exercise", icon: <Award className="w-5 h-5 text-secondary" />, bg: "bg-secondary/20" },
              { title: "Word Finder", desc: "Found 10 new vocabulary words", icon: <Zap className="w-5 h-5 text-primary" />, bg: "bg-primary/10" }
            ].map((item, i) => (
              <div key={i} className="bg-white border border-border/50 soft-shadow rounded-2xl p-4 flex items-center gap-4 cursor-pointer active:scale-[0.98] transition-transform">
                <div className={`w-12 h-12 rounded-2xl ${item.bg} flex items-center justify-center`}>
                  {item.icon}
                </div>
                <div className="flex-1">
                  <h4 className="font-display font-bold text-foreground text-base">{item.title}</h4>
                  <p className="text-xs font-medium text-muted-foreground">{item.desc}</p>
                </div>
                <ChevronRight className="w-5 h-5 text-muted-foreground/50" />
              </div>
            ))}
          </div>
        </div>
        
      </div>

      {/* Bottom Nav */}
      <nav className="absolute bottom-0 w-full bg-white/90 backdrop-blur-xl border-t border-border/60 px-6 py-5 pb-8 z-50 rounded-t-[2.5rem] soft-shadow">
        <div className="flex justify-between items-center max-w-sm mx-auto">
          <button className="flex flex-col items-center gap-1.5 text-primary">
            <div className="w-12 h-12 bg-primary/10 rounded-2xl flex items-center justify-center">
              <Compass className="w-6 h-6" />
            </div>
            <span className="text-[11px] font-bold">Home</span>
          </button>
          <button className="flex flex-col items-center gap-1.5 text-muted-foreground hover:text-foreground transition-colors">
            <div className="w-12 h-12 flex items-center justify-center">
              <BookOpen className="w-6 h-6" />
            </div>
            <span className="text-[11px] font-bold">Library</span>
          </button>
          <button className="flex flex-col items-center gap-1.5 text-muted-foreground hover:text-foreground transition-colors">
            <div className="w-12 h-12 flex items-center justify-center">
              <MapIcon className="w-6 h-6" />
            </div>
            <span className="text-[11px] font-bold">Map</span>
          </button>
          <button className="flex flex-col items-center gap-1.5 text-muted-foreground hover:text-foreground transition-colors">
            <div className="w-12 h-12 flex items-center justify-center">
              <User className="w-6 h-6" />
            </div>
            <span className="text-[11px] font-bold">Profile</span>
          </button>
        </div>
      </nav>

    </div>
  );
}
