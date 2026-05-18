import React from "react";
import "./_group.css";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  BookOpen,
  Brain,
  Calendar,
  Clock,
  Settings,
  User,
  CheckCircle2,
  PlayCircle,
  BarChart3,
  HelpCircle,
} from "lucide-react";

export function Dashboard() {
  return (
    <div className="min-h-screen bg-[hsl(var(--background))] text-[hsl(var(--foreground))] font-sans font-normal selection:bg-slate-200">
      {/* Header */}
      <header className="sticky top-0 z-10 bg-white/80 backdrop-blur-md border-b border-slate-200 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-2 text-slate-500">
          <BookOpen className="w-5 h-5" />
          <span className="font-medium text-lg tracking-tight">AIVO</span>
        </div>
        <nav className="flex gap-6 text-sm font-medium text-slate-500">
          <a
            href="#"
            className="text-slate-800 hover:text-slate-900 border-b-2 border-slate-800 pb-1"
          >
            Overview
          </a>
          <a href="#" className="hover:text-slate-800 transition-colors">
            Tutors
          </a>
          <a href="#" className="hover:text-slate-800 transition-colors">
            Settings
          </a>
        </nav>
        <Avatar className="h-8 w-8 border border-slate-200 bg-slate-50">
          <AvatarFallback className="text-xs text-slate-500 font-medium">P</AvatarFallback>
        </Avatar>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-12 space-y-12">
        {/* Child Profile */}
        <section className="flex flex-col md:flex-row items-start md:items-center gap-6 pb-12 border-b border-slate-200">
          <Avatar className="h-20 w-20 border border-slate-200 bg-slate-50">
            <AvatarImage
              src="/__mockup/images/nd-calm-avatar.png"
              alt="Leo"
              className="object-cover"
            />
            <AvatarFallback className="text-2xl text-slate-500 font-medium">L</AvatarFallback>
          </Avatar>
          <div className="space-y-2 flex-1">
            <h1 className="text-3xl font-medium tracking-tight text-slate-800">Leo's Workspace</h1>
            <div className="flex flex-wrap items-center gap-3 text-sm">
              <Badge
                variant="outline"
                className="bg-white text-slate-600 border-slate-200 font-normal px-2.5 py-0.5 rounded-full"
              >
                Level 2: Supported
              </Badge>
              <span className="text-slate-300">•</span>
              <span className="text-slate-500 flex items-center gap-1.5">
                <Settings className="w-4 h-4 text-slate-400" />
                Sensory Profile: Low Visual, Routine-based
              </span>
            </div>
          </div>
          <Button
            variant="outline"
            className="bg-white border-slate-200 text-slate-600 hover:bg-slate-50 hover:text-slate-800 font-medium gap-2"
          >
            <Calendar className="w-4 h-4" />
            Edit Schedule
          </Button>
        </section>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-12">
          {/* Left Column */}
          <div className="lg:col-span-2 space-y-12">
            {/* Today Snapshot */}
            <section className="space-y-6">
              <h2 className="text-lg font-medium text-slate-800 flex items-center gap-2">
                <Clock className="w-5 h-5 text-slate-400" />
                Today's Summary
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-px bg-slate-200 border border-slate-200 rounded-xl overflow-hidden">
                <div className="bg-white p-6 space-y-1">
                  <p className="text-sm text-slate-500 font-medium">Time Learned</p>
                  <p className="text-3xl font-medium text-slate-800">
                    24 <span className="text-base font-normal text-slate-500">min</span>
                  </p>
                </div>
                <div className="bg-white p-6 space-y-1">
                  <p className="text-sm text-slate-500 font-medium">Current Streak</p>
                  <p className="text-3xl font-medium text-slate-800">
                    5 <span className="text-base font-normal text-slate-500">days</span>
                  </p>
                </div>
                <div className="bg-white p-6 space-y-1">
                  <p className="text-sm text-slate-500 font-medium">Last Session</p>
                  <p className="text-base font-medium text-slate-800 mt-2">Math with Atlas</p>
                  <p className="text-sm text-slate-500">Completed 10 mins ago</p>
                </div>
              </div>
            </section>

            {/* Next Action */}
            <section className="bg-[hsl(var(--secondary)/0.1)] border border-[hsl(var(--secondary)/0.2)] rounded-xl p-8 flex flex-col md:flex-row items-center justify-between gap-6">
              <div className="space-y-2">
                <h3 className="text-lg font-medium text-slate-800">Recommended Next Activity</h3>
                <p className="text-slate-600 text-sm max-w-md">
                  Leo usually enjoys reading stories around this time. Muse is ready with a new
                  adventure about space exploration.
                </p>
              </div>
              <Button className="bg-[hsl(var(--secondary))] hover:bg-[hsl(var(--secondary)/0.9)] text-white font-medium px-6 py-6 h-auto w-full md:w-auto gap-2">
                <PlayCircle className="w-5 h-5" />
                Start Story Time
              </Button>
            </section>

            {/* Brain-Clone Progress */}
            <section className="space-y-6">
              <h2 className="text-lg font-medium text-slate-800 flex items-center gap-2">
                <Brain className="w-5 h-5 text-slate-400" />
                Learning Profile Adaptation
              </h2>
              <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-6">
                <p className="text-sm text-slate-500 leading-relaxed">
                  AIVO's Brain-Clone has updated based on Leo's recent interactions. The system
                  noticed he responds well to step-by-step visual instructions.
                </p>

                <div className="space-y-4">
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="font-medium text-slate-700">
                        Visual Processing Preference
                      </span>
                      <span className="text-slate-500">High Confidence</span>
                    </div>
                    <Progress
                      value={85}
                      className="h-2 bg-slate-100 [&>div]:bg-[hsl(var(--primary))]"
                    />
                  </div>

                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="font-medium text-slate-700">
                        Audio Instructions Efficacy
                      </span>
                      <span className="text-slate-500">Adapting...</span>
                    </div>
                    <Progress value={45} className="h-2 bg-slate-100 [&>div]:bg-slate-400" />
                  </div>
                </div>
              </div>
            </section>
          </div>

          {/* Right Column */}
          <div className="space-y-12">
            {/* Tutors */}
            <section className="space-y-6">
              <h2 className="text-lg font-medium text-slate-800 flex items-center gap-2">
                <User className="w-5 h-5 text-slate-400" />
                Active Tutors
              </h2>
              <div className="space-y-3">
                {[
                  { name: "Atlas", role: "Mathematics", time: "Today, 10:30 AM", active: true },
                  {
                    name: "Muse",
                    role: "Reading & Storytelling",
                    time: "Yesterday",
                    active: false,
                  },
                  { name: "Nova", role: "Science Explorer", time: "2 days ago", active: false },
                  { name: "Echo", role: "Speech Practice", time: "Last week", active: false },
                ].map((tutor, i) => (
                  <div
                    key={i}
                    className="bg-white border border-slate-200 p-4 rounded-xl flex items-center gap-4 hover:border-slate-300 transition-colors"
                  >
                    <div
                      className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-medium ${tutor.active ? "bg-[hsl(var(--primary)/0.1)] text-[hsl(var(--primary))]" : "bg-slate-100 text-slate-500"}`}
                    >
                      {tutor.name[0]}
                    </div>
                    <div>
                      <p className="font-medium text-slate-800 text-sm">
                        {tutor.name}{" "}
                        <span className="text-slate-400 font-normal">— {tutor.role}</span>
                      </p>
                      <p className="text-xs text-slate-500 mt-0.5">Last seen: {tutor.time}</p>
                    </div>
                  </div>
                ))}
              </div>
            </section>

            {/* Quick Settings */}
            <section className="space-y-6">
              <h2 className="text-lg font-medium text-slate-800 flex items-center gap-2">
                <Settings className="w-5 h-5 text-slate-400" />
                Quick Preferences
              </h2>
              <div className="bg-white border border-slate-200 rounded-xl p-1 divide-y divide-slate-100">
                <div className="p-4 flex items-center justify-between">
                  <div>
                    <Label className="text-sm font-medium text-slate-800">Reduced Motion</Label>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Disables animations across the app
                    </p>
                  </div>
                  <Switch checked={true} />
                </div>
                <div className="p-4 flex items-center justify-between">
                  <div>
                    <Label className="text-sm font-medium text-slate-800">High Contrast Text</Label>
                    <p className="text-xs text-slate-500 mt-0.5">Increases text readability</p>
                  </div>
                  <Switch checked={false} />
                </div>
                <div className="p-4 flex items-center justify-between">
                  <div>
                    <Label className="text-sm font-medium text-slate-800">Audio Cues</Label>
                    <p className="text-xs text-slate-500 mt-0.5">Play sounds on task completion</p>
                  </div>
                  <Switch checked={true} />
                </div>
              </div>
            </section>
          </div>
        </div>
      </main>
    </div>
  );
}
