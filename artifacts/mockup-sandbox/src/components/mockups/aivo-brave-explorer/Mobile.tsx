import React from "react";
import { Star, Shield, Zap, Sparkles, Map, ChevronRight, Play } from "lucide-react";
import "./_group.css";

export function Mobile() {
  return (
    <div className="brave-theme font-sans min-h-[844px] bg-[#f8fafe] text-[#041230] relative overflow-hidden flex flex-col">
      {/* Status Bar Mock */}
      <div className="h-12 w-full flex items-center justify-between px-6 pt-2 z-10 relative">
        <span className="text-sm font-bold">9:41</span>
        <div className="flex items-center gap-1">
          <div className="w-4 h-4 rounded-full border-2 border-current" />
          <div className="w-4 h-4 rounded-full border-2 border-current" />
          <div className="w-5 h-3 rounded-sm border-2 border-current" />
        </div>
      </div>

      {/* Header */}
      <header className="px-6 py-4 flex items-center justify-between z-10 relative">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-full bg-white border-2 border-[#e2e8f0] overflow-hidden">
            <img src="/__mockup/images/brave-tutor-1.png" alt="Avatar" className="w-full h-full object-cover" />
          </div>
          <div>
            <h1 className="font-display text-xl font-bold">Hi, Leo!</h1>
            <div className="text-sm font-bold text-blue-600 flex items-center gap-1">
              <Star className="w-4 h-4 fill-current" /> 420 XP
            </div>
          </div>
        </div>
        <div className="flex gap-2">
          <div className="bg-red-100 text-red-600 px-3 py-1.5 rounded-full font-bold flex items-center gap-1">
            <Zap className="w-4 h-4 fill-current" /> 5
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <div className="flex-1 overflow-y-auto px-4 pb-24 z-10 relative">
        {/* Daily Quest */}
        <div className="mt-4 brave-card p-5 bg-gradient-to-br from-blue-500 to-blue-600 text-white relative overflow-hidden">
          <div className="absolute top-0 right-0 opacity-20 -mr-4 -mt-4">
            <Sparkles className="w-24 h-24" />
          </div>
          <div className="relative z-10">
            <div className="inline-block px-3 py-1 rounded-full bg-white/20 font-bold text-sm mb-3 backdrop-blur-sm">
              Today's Quest
            </div>
            <h2 className="font-display text-2xl font-bold mb-1">Math Kingdom</h2>
            <p className="opacity-90 font-medium mb-4">Master basic addition</p>
            
            <div className="mb-4">
              <div className="flex justify-between text-sm font-bold mb-1.5">
                <span>Progress</span>
                <span>60%</span>
              </div>
              <div className="progress-track bg-black/20">
                <div className="progress-fill bg-yellow-400 w-[60%]" />
              </div>
            </div>

            <button className="brave-btn-secondary w-full py-3 flex items-center justify-center gap-2 text-lg">
              <Play className="w-5 h-5 fill-current" /> Continue Quest
            </button>
          </div>
        </div>

        {/* Path / Map */}
        <div className="mt-8 relative">
          <div className="absolute left-8 top-8 bottom-0 w-3 bg-blue-100 rounded-full" />
          
          <div className="flex gap-4 items-center mb-8 relative">
            <div className="w-16 h-16 rounded-full bg-green-500 border-4 border-white shadow-lg flex items-center justify-center z-10 text-white transform scale-110">
              <Star className="w-8 h-8 fill-current" />
            </div>
            <div className="brave-card flex-1 p-4">
              <h3 className="font-display font-bold text-lg text-green-600">Level 1</h3>
              <p className="text-sm font-medium opacity-70">Counting apples</p>
            </div>
          </div>

          <div className="flex gap-4 items-center mb-8 relative">
            <div className="w-16 h-16 rounded-full bg-blue-500 border-4 border-white shadow-lg flex items-center justify-center z-10 text-white transform scale-110">
              <Star className="w-8 h-8 fill-current" />
            </div>
            <div className="brave-card flex-1 p-4">
              <h3 className="font-display font-bold text-lg text-blue-600">Level 2</h3>
              <p className="text-sm font-medium opacity-70">Shape matching</p>
            </div>
          </div>

          <div className="flex gap-4 items-center relative opacity-60 grayscale">
            <div className="w-16 h-16 rounded-full bg-gray-300 border-4 border-white shadow-lg flex items-center justify-center z-10 text-white">
              <Shield className="w-8 h-8 fill-current" />
            </div>
            <div className="brave-card flex-1 p-4">
              <h3 className="font-display font-bold text-lg text-gray-600">Boss Level</h3>
              <p className="text-sm font-medium opacity-70">Locked</p>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Nav */}
      <div className="absolute bottom-0 left-0 right-0 h-24 bg-white border-t-2 border-gray-100 px-6 flex items-center justify-between z-20 pb-4">
        <button className="flex flex-col items-center gap-1 text-blue-600 transform scale-110">
          <Map className="w-7 h-7" />
          <span className="font-bold text-xs">Quests</span>
        </button>
        <button className="flex flex-col items-center gap-1 text-gray-400 hover:text-blue-600 transition-colors">
          <Star className="w-7 h-7" />
          <span className="font-bold text-xs">Badges</span>
        </button>
        <button className="flex flex-col items-center gap-1 text-gray-400 hover:text-blue-600 transition-colors">
          <Shield className="w-7 h-7" />
          <span className="font-bold text-xs">Profile</span>
        </button>
      </div>
    </div>
  );
}
