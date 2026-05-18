import React from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Sparkles, Compass, User, BookOpen, Star, Orbit, ChevronRight, Award, Zap } from "lucide-react";
import "./_group.css";

export function Mobile() {
  return (
    <div className="cosmic-theme min-h-[100dvh] w-full max-w-[390px] mx-auto overflow-hidden flex flex-col font-sans text-foreground bg-aurora relative shadow-2xl">
      
      {/* Decorative stars */}
      <div className="absolute top-[10%] left-[20%] constellation-dot animate-pulse"></div>
      <div className="absolute top-[15%] right-[30%] constellation-dot"></div>
      <div className="absolute top-[25%] left-[80%] constellation-dot animate-pulse"></div>
      <div className="absolute top-[40%] left-[10%] constellation-dot"></div>
      
      {/* Status Bar Mock */}
      <div className="w-full h-12 flex items-end justify-between px-6 pb-2 text-xs font-medium text-white/80 z-50">
        <span>9:41</span>
        <div className="flex items-center gap-1.5">
          <div className="w-4 h-3 rounded-sm border border-white/60"></div>
          <div className="w-3 h-3 rounded-full bg-white/80"></div>
        </div>
      </div>

      {/* Header */}
      <header className="px-6 pt-6 pb-4 relative z-10 flex justify-between items-center">
        <div>
          <h1 className="font-display font-bold text-2xl text-white tracking-tight">Hi, Leo!</h1>
          <p className="text-primary text-sm font-medium flex items-center gap-1">
            <Sparkles className="w-3 h-3" /> Level 4 Explorer
          </p>
        </div>
        <div className="w-12 h-12 rounded-full glass-panel border-primary/30 p-1 relative">
          <img 
            src="/__mockup/images/aivo-cosmic-lab/mobile-avatar.png" 
            alt="Avatar" 
            className="w-full h-full rounded-full object-cover bg-background"
          />
          <div className="absolute -bottom-1 -right-1 w-5 h-5 bg-secondary rounded-full flex items-center justify-center border border-[#131b2f]">
            <span className="text-[9px] font-bold text-white">12</span>
          </div>
        </div>
      </header>

      {/* Scrollable Content */}
      <div className="flex-1 overflow-y-auto px-6 pb-24 scrollbar-hide z-10">
        
        {/* Today's Journey */}
        <div className="mt-4 mb-8">
          <h2 className="font-display text-sm font-semibold text-white/70 uppercase tracking-wider mb-4">Today's Constellation</h2>
          
          <Card className="glass-panel border-primary/20 bg-card/40 p-5 rounded-2xl relative overflow-hidden animate-pulse-glow">
            <div className="absolute -right-10 -top-10 w-32 h-32 bg-primary/20 rounded-full blur-2xl"></div>
            
            <div className="flex justify-between items-start mb-6 relative z-10">
              <div>
                <Badge className="bg-primary/20 text-primary hover:bg-primary/30 border-none mb-2 px-2 py-0.5 text-xs">
                  Next Mission
                </Badge>
                <h3 className="font-display font-bold text-xl text-white leading-tight">Numbers in Space</h3>
                <p className="text-muted-foreground text-sm mt-1">Math • 10 mins</p>
              </div>
              <div className="w-10 h-10 rounded-full bg-background border border-primary/30 flex items-center justify-center">
                <Compass className="w-5 h-5 text-primary" />
              </div>
            </div>
            
            <Button className="w-full font-display font-bold bg-primary hover:bg-primary/90 text-primary-foreground h-12 rounded-xl text-base shadow-[0_0_15px_rgba(45,212,191,0.3)] border-none">
              Start Exploring
            </Button>
          </Card>
        </div>

        {/* Tutors Carousel */}
        <div className="mb-8">
          <div className="flex justify-between items-end mb-4">
            <h2 className="font-display text-sm font-semibold text-white/70 uppercase tracking-wider">Your Guides</h2>
            <span className="text-xs text-primary font-medium">View All</span>
          </div>
          
          <div className="flex gap-4 overflow-x-auto pb-4 scrollbar-hide -mx-6 px-6">
            {[
              { name: "Nova", role: "Reading", color: "text-primary", bg: "bg-primary/10", border: "border-primary/20" },
              { name: "Orion", role: "Emotions", color: "text-secondary", bg: "bg-secondary/10", border: "border-secondary/20" },
              { name: "Lyra", role: "Focus", color: "text-blue-400", bg: "bg-blue-400/10", border: "border-blue-400/20" },
            ].map((tutor, i) => (
              <div key={i} className={`flex-shrink-0 w-28 rounded-2xl glass-panel ${tutor.bg} ${tutor.border} p-4 flex flex-col items-center justify-center text-center animate-float`} style={{animationDelay: `${i * 0.5}s`}}>
                <div className={`w-12 h-12 rounded-full bg-background/50 flex items-center justify-center mb-3 shadow-[0_0_10px_rgba(255,255,255,0.05)]`}>
                  <Orbit className={`w-6 h-6 ${tutor.color}`} />
                </div>
                <h4 className="font-display font-bold text-white text-sm">{tutor.name}</h4>
                <p className="text-[10px] text-muted-foreground mt-0.5">{tutor.role}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Recent Achievements */}
        <div>
          <h2 className="font-display text-sm font-semibold text-white/70 uppercase tracking-wider mb-4">Discoveries</h2>
          <div className="space-y-3">
            {[
              { title: "Quiet Focus", desc: "Completed a 5-min calming exercise", icon: <Award className="w-4 h-4 text-secondary" /> },
              { title: "Word Finder", desc: "Found 10 new vocabulary words", icon: <Zap className="w-4 h-4 text-primary" /> }
            ].map((item, i) => (
              <div key={i} className="glass-panel border-white/5 rounded-xl p-4 flex items-center gap-4">
                <div className="w-10 h-10 rounded-full bg-background/50 flex items-center justify-center border border-white/5">
                  {item.icon}
                </div>
                <div className="flex-1">
                  <h4 className="font-display font-medium text-white text-sm">{item.title}</h4>
                  <p className="text-xs text-muted-foreground">{item.desc}</p>
                </div>
                <ChevronRight className="w-4 h-4 text-white/20" />
              </div>
            ))}
          </div>
        </div>
        
      </div>

      {/* Bottom Nav */}
      <nav className="absolute bottom-0 w-full glass-panel border-t border-white/10 px-6 py-4 pb-8 z-50">
        <div className="flex justify-between items-center">
          <button className="flex flex-col items-center gap-1 text-primary">
            <Compass className="w-6 h-6" />
            <span className="text-[10px] font-medium">Home</span>
          </button>
          <button className="flex flex-col items-center gap-1 text-muted-foreground hover:text-white/80 transition-colors">
            <BookOpen className="w-6 h-6" />
            <span className="text-[10px] font-medium">Library</span>
          </button>
          <button className="flex flex-col items-center gap-1 text-muted-foreground hover:text-white/80 transition-colors">
            <Star className="w-6 h-6" />
            <span className="text-[10px] font-medium">Tutors</span>
          </button>
          <button className="flex flex-col items-center gap-1 text-muted-foreground hover:text-white/80 transition-colors">
            <User className="w-6 h-6" />
            <span className="text-[10px] font-medium">Profile</span>
          </button>
        </div>
      </nav>

    </div>
  );
}

// Simple Badge component inline since we are not importing from UI properly in this isolated snippet context without guaranteeing it exists exactly as expected.
function Badge({ children, className }: { children: React.ReactNode, className?: string }) {
  return (
    <span className={`inline-flex items-center rounded-md font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 ${className}`}>
      {children}
    </span>
  );
}
