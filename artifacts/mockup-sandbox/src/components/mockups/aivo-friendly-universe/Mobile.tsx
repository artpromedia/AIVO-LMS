import React from "react";
import "./_group.css";
import {
  Sparkles,
  Map,
  Star,
  BookOpen,
  Settings,
  Battery,
  Zap,
  ChevronRight,
  Trophy,
} from "lucide-react";

export function Mobile() {
  return (
    <div className="font-nunito bg-[#F8FAFC] text-[#334155] w-full min-h-screen relative overflow-hidden flex flex-col">
      {/* Top Status Bar Area */}
      <div className="w-full h-12 flex justify-between items-center px-6 text-sm font-semibold text-[#94A3B8] z-20">
        <span>9:41</span>
        <div className="flex items-center gap-2">
          <Battery className="w-5 h-5" />
        </div>
      </div>

      {/* Floating Background Elements */}
      <div className="absolute top-[-5%] right-[-10%] w-[80%] h-[40%] rounded-full bg-[#E0E7FF] blur-[80px] opacity-60 pointer-events-none" />
      <div className="absolute bottom-[20%] left-[-10%] w-[60%] h-[30%] rounded-full bg-[#FFEDD5] blur-[80px] opacity-60 pointer-events-none" />

      {/* Header */}
      <header className="px-6 pt-4 pb-6 z-10 flex justify-between items-start">
        <div>
          <h1 className="font-fredoka text-3xl font-semibold text-[#334155]">Hi, Leo</h1>
          <p className="text-[#64748B] font-medium mt-1">Ready for a calm adventure?</p>
        </div>
        <div className="w-12 h-12 rounded-full bg-white friendly-soft-shadow border border-[#E2E8F0] flex items-center justify-center cursor-pointer active:scale-95 transition-transform">
          <Settings className="w-6 h-6 text-[#94A3B8]" />
        </div>
      </header>

      {/* Main Mascot / Companion Area */}
      <div className="px-6 z-10 flex-1 flex flex-col items-center justify-center mb-8">
        <div className="relative w-full max-w-[280px] aspect-square animate-float">
          <div className="absolute inset-0 bg-[#818CF8]/10 rounded-full blur-2xl" />
          <img
            src="/__mockup/images/aivo-friendly/mascot.png"
            alt="AIVO Companion"
            className="relative z-10 w-full h-full object-contain"
          />

          {/* Chat Bubble */}
          <div className="absolute top-4 -right-4 bg-white px-5 py-3 rounded-2xl rounded-bl-none friendly-soft-shadow-md border border-[#E2E8F0] animate-float-delayed z-20">
            <p className="font-semibold text-sm text-[#334155]">Let's read a story about trains!</p>
          </div>
        </div>
      </div>

      {/* Quick Stats */}
      <div className="px-6 z-10 mb-8 flex gap-4">
        <div className="flex-1 bg-white rounded-3xl p-4 friendly-soft-shadow border border-[#E2E8F0] flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-[#FFEDD5] flex items-center justify-center">
            <Star className="w-5 h-5 text-[#F59E0B] fill-current" />
          </div>
          <div>
            <p className="text-xs font-bold text-[#94A3B8] uppercase tracking-wider">Stars</p>
            <p className="font-fredoka text-xl font-semibold text-[#334155]">124</p>
          </div>
        </div>
        <div className="flex-1 bg-white rounded-3xl p-4 friendly-soft-shadow border border-[#E2E8F0] flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-[#E0E7FF] flex items-center justify-center">
            <Zap className="w-5 h-5 text-[#818CF8]" />
          </div>
          <div>
            <p className="text-xs font-bold text-[#94A3B8] uppercase tracking-wider">Energy</p>
            <p className="font-fredoka text-xl font-semibold text-[#334155]">100%</p>
          </div>
        </div>
      </div>

      {/* Next Activity Card */}
      <div className="px-6 pb-24 z-10">
        <h2 className="font-fredoka text-xl font-semibold text-[#334155] mb-4">Today's Journey</h2>
        <div className="bg-white rounded-[2rem] p-6 friendly-soft-shadow border border-[#E2E8F0] cursor-pointer active:scale-[0.98] transition-transform">
          <div className="flex justify-between items-center mb-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-[#F3E8FF] flex items-center justify-center">
                <BookOpen className="w-6 h-6 text-[#C084FC]" />
              </div>
              <div>
                <p className="font-fredoka text-lg font-semibold text-[#334155]">Reading Time</p>
                <p className="text-sm font-medium text-[#64748B]">The Little Train That Could</p>
              </div>
            </div>
            <ChevronRight className="w-6 h-6 text-[#94A3B8]" />
          </div>

          {/* Gentle Progress Bar */}
          <div className="w-full h-3 bg-[#F8FAFC] rounded-full overflow-hidden border border-[#E2E8F0]">
            <div className="h-full bg-gradient-to-r from-[#818CF8] to-[#C084FC] w-[30%] rounded-full relative">
              <div className="absolute inset-0 bg-white/20" />
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Navigation */}
      <div className="absolute bottom-0 w-full bg-white/90 backdrop-blur-md border-t border-[#E2E8F0] px-6 py-6 pb-8 z-30 flex justify-between items-center rounded-t-3xl">
        <button className="flex flex-col items-center gap-1.5 text-[#818CF8]">
          <div className="w-12 h-12 bg-[#E0E7FF] rounded-full flex items-center justify-center">
            <Sparkles className="w-6 h-6" />
          </div>
          <span className="text-xs font-bold">Home</span>
        </button>
        <button className="flex flex-col items-center gap-1.5 text-[#94A3B8] hover:text-[#64748B] transition-colors">
          <div className="w-12 h-12 flex items-center justify-center">
            <Map className="w-6 h-6" />
          </div>
          <span className="text-xs font-bold">Map</span>
        </button>
        <button className="flex flex-col items-center gap-1.5 text-[#94A3B8] hover:text-[#64748B] transition-colors">
          <div className="w-12 h-12 flex items-center justify-center">
            <Trophy className="w-6 h-6" />
          </div>
          <span className="text-xs font-bold">Rewards</span>
        </button>
      </div>
    </div>
  );
}
