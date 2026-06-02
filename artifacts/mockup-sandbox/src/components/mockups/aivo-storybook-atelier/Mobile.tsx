import React from "react";
import { Settings, Map, Award, Volume2, Star, BookOpen, User, Menu } from "lucide-react";
import "./_group.css";

export function Mobile() {
  return (
    <div className="storybook-theme relative max-w-[390px] mx-auto min-h-[844px] bg-background text-foreground overflow-hidden font-sans shadow-2xl border border-border/30 rounded-[3rem]">
      <div className="paper-texture"></div>

      {/* iOS Status Bar Placeholder */}
      <div className="relative z-50 flex justify-between items-center px-6 pt-4 pb-2 text-sm font-medium">
        <span>9:41</span>
        <div className="flex gap-1.5 items-center">
          <div className="w-4 h-3 bg-foreground rounded-[2px]"></div>
          <div className="w-3 h-3 bg-foreground rounded-full"></div>
          <div className="w-6 h-3 bg-foreground rounded-[2px]"></div>
        </div>
      </div>

      <main className="relative z-10 h-full flex flex-col">
        {/* Top Header */}
        <header className="px-6 py-4 flex justify-between items-center bg-background/80 backdrop-blur-sm z-20">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center organic-border border-2 border-primary/30">
              <User className="w-5 h-5 text-primary" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground font-semibold uppercase tracking-wider">
                Explorer
              </p>
              <h1 className="font-display text-xl font-bold">Leo</h1>
            </div>
          </div>
          <button className="w-10 h-10 rounded-full bg-secondary/20 flex items-center justify-center text-secondary organic-border">
            <Star className="w-5 h-5" fill="currentColor" />
          </button>
        </header>

        {/* Map Area */}
        <div className="flex-1 relative overflow-hidden bg-[#e9e1d3]">
          {/* We use the generated map image as a rich background */}
          <img
            src="/__mockup/images/storybook-map.png"
            alt="World Map"
            className="absolute inset-0 w-full h-full object-cover object-bottom"
          />

          {/* Map Overlay Elements - Nodes on the journey */}
          <div className="absolute inset-0 z-10">
            {/* Completed Node */}
            <button className="absolute top-[20%] left-[20%] w-14 h-14 rounded-full bg-accent text-accent-foreground flex items-center justify-center shadow-lg organic-border border-2 border-white/50 transform -rotate-6">
              <Star className="w-6 h-6" fill="currentColor" />
            </button>
            <div className="absolute top-[28%] left-[25%] px-3 py-1 bg-white/90 backdrop-blur-sm rounded-full text-xs font-bold text-accent shadow-sm">
              Meadow Math
            </div>

            {/* Path visualization (SVG placeholder for the dotted line) */}
            <svg
              className="absolute top-[25%] left-[30%] w-32 h-32"
              style={{ pointerEvents: "none" }}
            >
              <path
                d="M 0 0 Q 50 50 100 10"
                fill="none"
                stroke="rgba(255,255,255,0.6)"
                strokeWidth="4"
                strokeDasharray="8 8"
                strokeLinecap="round"
              />
            </svg>

            {/* Current Node */}
            <div className="absolute top-[35%] right-[15%]">
              <div className="absolute -inset-2 bg-primary/30 rounded-full animate-pulse organic-border"></div>
              <button className="relative w-16 h-16 rounded-full bg-primary text-primary-foreground flex items-center justify-center shadow-xl organic-border border-2 border-white transform scale-110 rotate-3">
                <BookOpen className="w-7 h-7" />
              </button>
              <div className="absolute mt-2 -ml-4 px-4 py-1.5 bg-white rounded-full text-sm font-bold text-primary shadow-md whitespace-nowrap text-center">
                Reading Tree
              </div>
            </div>

            {/* Future Node */}
            <button className="absolute bottom-[35%] left-[35%] w-14 h-14 rounded-full bg-white/60 text-muted-foreground flex items-center justify-center organic-border backdrop-blur-sm border-2 border-white/40">
              <div className="w-4 h-4 rounded-full bg-muted-foreground/30"></div>
            </button>
          </div>
        </div>

        {/* Bottom Card - Current Activity */}
        <div className="relative z-20 bg-background rounded-t-[2.5rem] p-6 shadow-[0_-10px_40px_rgba(0,0,0,0.05)] border-t border-border/50 pb-8">
          <div className="w-12 h-1.5 bg-border rounded-full mx-auto mb-6"></div>

          <h2 className="font-display text-2xl mb-2 text-foreground">Today's Story</h2>
          <p className="text-muted-foreground mb-6 text-sm">
            Professor Badger is waiting in the Reading Tree with a new adventure.
          </p>

          <button className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-bold text-lg py-4 rounded-full organic-border shadow-lg shadow-primary/20 flex items-center justify-center gap-3 active:scale-95 transition-transform">
            <Play className="w-5 h-5" fill="currentColor" />
            Let's Go!
          </button>
        </div>

        {/* Navigation Bar */}
        <nav className="relative z-30 bg-background border-t border-border/50 px-6 py-4 flex justify-between items-center pb-8">
          <button className="flex flex-col items-center gap-1 text-primary">
            <Map className="w-6 h-6" />
            <span className="text-[10px] font-bold">Map</span>
          </button>
          <button className="flex flex-col items-center gap-1 text-muted-foreground hover:text-foreground transition-colors">
            <Award className="w-6 h-6" />
            <span className="text-[10px] font-bold">Prizes</span>
          </button>
          <button className="flex flex-col items-center gap-1 text-muted-foreground hover:text-foreground transition-colors">
            <Volume2 className="w-6 h-6" />
            <span className="text-[10px] font-bold">Sound</span>
          </button>
          <button className="flex flex-col items-center gap-1 text-muted-foreground hover:text-foreground transition-colors">
            <Menu className="w-6 h-6" />
            <span className="text-[10px] font-bold">More</span>
          </button>
        </nav>
      </main>
    </div>
  );
}
