import React from "react";
import { 
  Heart, Star, Zap, Clock, Shield, Brain, Sparkles, Home, Settings,
  MessageCircle, BarChart3, Users, Puzzle, Activity, CheckCircle2,
  Calendar, Plus, Target, ChevronRight, Play, Award, HelpCircle
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Progress } from "@/components/ui/progress";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import "./_group.css";

// ----------------------------------------------------------------------
// DATA
// ----------------------------------------------------------------------
const childProfile = {
  name: "Leo",
  avatar: "/__mockup/images/nd-visual-avatar.png",
  level: "Level 3",
  levelColor: "bg-[hsl(var(--visual-primary-light))] text-[hsl(var(--visual-primary))] border-[hsl(var(--visual-primary))]/20",
  sensory: {
    audio: "Low",
    visual: "High",
    movement: "Medium"
  }
};

const stats = {
  minutesToday: 45,
  streak: 12,
  lastSession: "Math with Nova (15m)"
};

const tutors = [
  { id: 1, name: "Nova", role: "Math Explorer", color: "bg-[hsl(var(--visual-math))]/10 text-[hsl(var(--visual-math))] border-[hsl(var(--visual-math))]/20", iconColor: "text-[hsl(var(--visual-math))]", lastSeen: "Today" },
  { id: 2, name: "Atlas", role: "Reading Guide", color: "bg-[hsl(var(--visual-reading))]/10 text-[hsl(var(--visual-reading))] border-[hsl(var(--visual-reading))]/20", iconColor: "text-[hsl(var(--visual-reading))]", lastSeen: "Yesterday" },
  { id: 3, name: "Echo", role: "Science Buddy", color: "bg-[hsl(var(--visual-science))]/10 text-[hsl(var(--visual-science))] border-[hsl(var(--visual-science))]/20", iconColor: "text-[hsl(var(--visual-science))]", lastSeen: "2 days ago" },
  { id: 4, name: "Spark", role: "Feelings Friend", color: "bg-[hsl(var(--visual-sel))]/10 text-[hsl(var(--visual-sel))] border-[hsl(var(--visual-sel))]/20", iconColor: "text-[hsl(var(--visual-sel))]", lastSeen: "Today" },
];

const brainClone = {
  level: 8,
  progress: 65,
  skills: [
    { name: "Pattern Recognition", mastery: 4, total: 5, color: "text-[hsl(var(--visual-math))]" },
    { name: "Phonics", mastery: 2, total: 5, color: "text-[hsl(var(--visual-reading))]" },
    { name: "Emotional Regulation", mastery: 3, total: 5, color: "text-[hsl(var(--visual-sel))]" },
  ]
};

const recentSessions = [
  { id: 1, subject: "Math", duration: "15m", tutor: "Nova", mood: "Happy", icon: Star, color: "text-[hsl(var(--visual-math))]", bg: "bg-[hsl(var(--visual-math))]/10" },
  { id: 2, subject: "SEL", duration: "10m", tutor: "Spark", mood: "Calm", icon: Heart, color: "text-[hsl(var(--visual-sel))]", bg: "bg-[hsl(var(--visual-sel))]/10" },
  { id: 3, subject: "Reading", duration: "20m", tutor: "Atlas", mood: "Focused", icon: Puzzle, color: "text-[hsl(var(--visual-reading))]", bg: "bg-[hsl(var(--visual-reading))]/10" },
];

// ----------------------------------------------------------------------
// COMPONENTS
// ----------------------------------------------------------------------

const ProgressDots = ({ mastery, total, colorClass }: { mastery: number, total: number, colorClass: string }) => {
  return (
    <div className="flex gap-1.5">
      {Array.from({ length: total }).map((_, i) => (
        <div 
          key={i} 
          className={`w-4 h-4 rounded-full ${i < mastery ? 'bg-current ' + colorClass : 'bg-gray-200'}`} 
        />
      ))}
    </div>
  );
};

export function Dashboard() {
  return (
    <div className="nd-visual min-h-screen pb-20 md:pb-8 flex flex-col md:flex-row">
      
      {/* Mobile Nav Bar (Bottom) / Desktop Nav (Side) */}
      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-100 p-4 flex justify-around items-center z-50 md:relative md:w-24 md:flex-col md:border-t-0 md:border-r md:justify-start md:pt-8 md:gap-8 shadow-[0_-4px_20px_rgba(0,0,0,0.05)] md:shadow-none">
        <div className="hidden md:flex mb-8">
          <div className="w-12 h-12 bg-[hsl(var(--visual-primary))] rounded-2xl flex items-center justify-center text-white font-bold text-xl transform rotate-3">A</div>
        </div>
        <button className="flex flex-col items-center gap-1 text-[hsl(var(--visual-primary))]">
          <div className="p-3 bg-[hsl(var(--visual-primary-light))] rounded-2xl">
            <Home size={24} strokeWidth={2.5} />
          </div>
          <span className="text-[10px] font-bold">Home</span>
        </button>
        <button className="flex flex-col items-center gap-1 text-gray-400 hover:text-gray-600 transition-colors">
          <div className="p-3 rounded-2xl">
            <BarChart3 size={24} strokeWidth={2.5} />
          </div>
          <span className="text-[10px] font-bold">Progress</span>
        </button>
        <button className="flex flex-col items-center gap-1 text-gray-400 hover:text-gray-600 transition-colors">
          <div className="p-3 rounded-2xl">
            <MessageCircle size={24} strokeWidth={2.5} />
          </div>
          <span className="text-[10px] font-bold">Tutors</span>
        </button>
        <button className="flex flex-col items-center gap-1 text-gray-400 hover:text-gray-600 transition-colors">
          <div className="p-3 rounded-2xl">
            <Settings size={24} strokeWidth={2.5} />
          </div>
          <span className="text-[10px] font-bold">Settings</span>
        </button>
      </nav>

      {/* Main Content */}
      <main className="flex-1 p-4 md:p-8 max-w-7xl mx-auto w-full flex flex-col gap-6 md:gap-8 overflow-y-auto">
        
        {/* Header Profile Area */}
        <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <Avatar className="w-16 h-16 border-4 border-white shadow-md">
              <AvatarImage src={childProfile.avatar} />
              <AvatarFallback>LE</AvatarFallback>
            </Avatar>
            <div>
              <h1 className="text-3xl flex items-center gap-2">
                Leo's Dashboard
              </h1>
              <div className="flex flex-wrap items-center gap-2 mt-1">
                <Badge className={`${childProfile.levelColor} px-3 py-1 text-sm border font-bold hover:bg-transparent`}>
                  <Target size={14} className="mr-1" /> {childProfile.level} Learner
                </Badge>
                <div className="flex gap-1">
                  <Badge variant="outline" className="bg-white border-gray-200 text-gray-600"><HelpCircle size={12} className="mr-1"/> Audio: {childProfile.sensory.audio}</Badge>
                  <Badge variant="outline" className="bg-white border-gray-200 text-gray-600"><Heart size={12} className="mr-1"/> Visual: {childProfile.sensory.visual}</Badge>
                </div>
              </div>
            </div>
          </div>
          
          <div className="flex gap-3">
             <Button variant="outline" className="nd-visual-button bg-white border-2 border-gray-100 h-12 px-6 shadow-sm">
               <Calendar size={18} className="mr-2 text-[hsl(var(--visual-primary))]" /> Schedule
             </Button>
          </div>
        </header>

        <div className="grid grid-cols-1 md:grid-cols-12 gap-6 md:gap-8">
          
          {/* LEFT COLUMN */}
          <div className="md:col-span-8 flex flex-col gap-6 md:gap-8">
            
            {/* Today Snapshot */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
              <Card className="nd-visual-card border-none bg-gradient-to-br from-[hsl(var(--visual-math))]/10 to-[hsl(var(--visual-math))]/5">
                <CardContent className="p-5 flex flex-col items-center justify-center text-center h-full">
                  <div className="w-12 h-12 bg-white rounded-full flex items-center justify-center mb-3 shadow-sm text-[hsl(var(--visual-math))]">
                    <Clock size={24} strokeWidth={3} />
                  </div>
                  <h3 className="text-3xl font-black text-[hsl(var(--visual-math))] leading-none">{stats.minutesToday}</h3>
                  <p className="text-sm font-bold text-gray-600 mt-1 uppercase tracking-wide">Mins Today</p>
                </CardContent>
              </Card>
              
              <Card className="nd-visual-card border-none bg-gradient-to-br from-[hsl(var(--visual-sel))]/10 to-[hsl(var(--visual-sel))]/5">
                <CardContent className="p-5 flex flex-col items-center justify-center text-center h-full">
                  <div className="w-12 h-12 bg-white rounded-full flex items-center justify-center mb-3 shadow-sm text-[hsl(var(--visual-sel))]">
                    <Zap size={24} strokeWidth={3} />
                  </div>
                  <h3 className="text-3xl font-black text-[hsl(var(--visual-sel))] leading-none">{stats.streak}</h3>
                  <p className="text-sm font-bold text-gray-600 mt-1 uppercase tracking-wide">Day Streak</p>
                </CardContent>
              </Card>

              <Card className="nd-visual-card border-none bg-[hsl(var(--visual-primary))]/5 col-span-2 sm:col-span-1">
                <CardContent className="p-5 flex flex-col items-center justify-center text-center h-full">
                  <div className="w-12 h-12 bg-white rounded-full flex items-center justify-center mb-3 shadow-sm text-[hsl(var(--visual-primary))]">
                    <CheckCircle2 size={24} strokeWidth={3} />
                  </div>
                  <h3 className="text-lg font-bold text-gray-800 leading-tight">Great job on Math!</h3>
                  <p className="text-sm font-bold text-gray-500 mt-1 uppercase tracking-wide">Last Session</p>
                </CardContent>
              </Card>
            </div>

            {/* Recommended Next Session (CTA) */}
            <Card className="nd-visual-card overflow-hidden relative">
              <div className="absolute right-0 top-0 bottom-0 w-1/3 bg-gradient-to-l from-[hsl(var(--visual-reading))]/20 to-transparent pointer-events-none" />
              <CardContent className="p-8 flex flex-col sm:flex-row items-center justify-between gap-6 relative z-10">
                <div className="flex items-center gap-6">
                  <div className="w-20 h-20 bg-[hsl(var(--visual-reading))]/20 rounded-3xl flex items-center justify-center text-[hsl(var(--visual-reading))] flex-shrink-0">
                    <Star size={40} strokeWidth={2.5} />
                  </div>
                  <div>
                    <Badge className="bg-[hsl(var(--visual-reading))] hover:bg-[hsl(var(--visual-reading))] mb-2 px-3 py-1 font-bold text-sm uppercase tracking-wider">Up Next</Badge>
                    <h2 className="text-2xl font-black text-gray-800 mb-1">Reading with Atlas</h2>
                    <p className="text-gray-600 font-medium">Continue the phonics adventure. About 15 minutes.</p>
                  </div>
                </div>
                <Button className="nd-visual-button bg-[hsl(var(--visual-reading))] hover:bg-[hsl(var(--visual-reading))]/90 text-white h-14 px-8 text-lg w-full sm:w-auto shadow-lg shadow-[hsl(var(--visual-reading))]/30 transition-transform active:scale-95">
                  <Play size={20} className="mr-2" fill="currentColor" /> Start Now
                </Button>
              </CardContent>
            </Card>

            {/* Active AI Tutors */}
            <div>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-2xl font-bold flex items-center gap-2">
                  <Users className="text-[hsl(var(--visual-primary))]" /> Leo's Tutors
                </h2>
                <Button variant="ghost" className="text-[hsl(var(--visual-primary))] font-bold uppercase tracking-wider text-sm hover:bg-[hsl(var(--visual-primary))]/10 rounded-full">
                  See All <ChevronRight size={16} className="ml-1" />
                </Button>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                {tutors.map((tutor) => (
                  <Card key={tutor.id} className={`nd-visual-card border-2 ${tutor.color} bg-white cursor-pointer hover:border-opacity-50`}>
                    <CardContent className="p-4 flex flex-col items-center text-center">
                      <div className={`w-16 h-16 rounded-full ${tutor.color.split(' ')[0]} flex items-center justify-center mb-3 ${tutor.iconColor}`}>
                        <Sparkles size={32} strokeWidth={2.5} />
                      </div>
                      <h3 className="font-bold text-lg text-gray-800">{tutor.name}</h3>
                      <p className="text-sm font-semibold opacity-80">{tutor.role}</p>
                      <Badge variant="secondary" className="mt-3 bg-white/50 text-xs">{tutor.lastSeen}</Badge>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>

          </div>

          {/* RIGHT COLUMN */}
          <div className="md:col-span-4 flex flex-col gap-6 md:gap-8">
            
            {/* Brain Clone Progress */}
            <Card className="nd-visual-card bg-gradient-to-b from-[hsl(var(--visual-primary))]/10 to-[hsl(var(--visual-primary))]/5 border-none">
              <CardContent className="p-6">
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-12 h-12 bg-white rounded-xl flex items-center justify-center text-[hsl(var(--visual-primary))] shadow-sm">
                    <Brain size={24} strokeWidth={2.5} />
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-gray-800">Leo's Brain-Clone</h2>
                    <p className="text-sm font-bold text-[hsl(var(--visual-primary))]">Level {brainClone.level} Intelligence</p>
                  </div>
                </div>
                
                <div className="space-y-5">
                  <div>
                    <div className="flex justify-between text-sm font-bold mb-2">
                      <span className="text-gray-600">Overall Accuracy</span>
                      <span className="text-[hsl(var(--visual-primary))]">{brainClone.progress}%</span>
                    </div>
                    <Progress value={brainClone.progress} className="h-3 bg-white [&>div]:bg-[hsl(var(--visual-primary))]" />
                  </div>

                  <div className="pt-4 border-t border-gray-200/50 space-y-4">
                    <h3 className="font-bold text-sm text-gray-500 uppercase tracking-wider">Skill Mastery</h3>
                    {brainClone.skills.map((skill, i) => (
                      <div key={i} className="flex flex-col gap-1">
                        <span className="text-sm font-bold text-gray-700">{skill.name}</span>
                        <ProgressDots mastery={skill.mastery} total={skill.total} colorClass={skill.color} />
                      </div>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Quick Settings */}
            <Card className="nd-visual-card">
              <CardContent className="p-6">
                <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
                  <Settings className="text-gray-400" size={20} /> Quick Controls
                </h2>
                <div className="space-y-4">
                  <div className="flex items-center justify-between bg-gray-50 p-3 rounded-2xl">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-white rounded-xl shadow-sm text-gray-500">
                        <Star size={18} />
                      </div>
                      <span className="font-bold text-sm text-gray-700">Sensory Mode</span>
                    </div>
                    <Switch defaultChecked />
                  </div>
                  <div className="flex items-center justify-between bg-gray-50 p-3 rounded-2xl">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-white rounded-xl shadow-sm text-gray-500">
                        <Shield size={18} />
                      </div>
                      <span className="font-bold text-sm text-gray-700">Focus Lock</span>
                    </div>
                    <Switch />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Recent Sessions Feed */}
            <Card className="nd-visual-card">
              <CardContent className="p-6">
                <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
                  <Activity className="text-gray-400" size={20} /> Recent Sessions
                </h2>
                <div className="space-y-4">
                  {recentSessions.map((session) => (
                    <div key={session.id} className="flex items-center gap-4">
                      <div className={`w-12 h-12 rounded-2xl ${session.bg} ${session.color} flex items-center justify-center flex-shrink-0`}>
                        <session.icon size={20} strokeWidth={2.5} />
                      </div>
                      <div className="flex-1">
                        <h4 className="font-bold text-sm text-gray-800">{session.subject} w/ {session.tutor}</h4>
                        <p className="text-xs font-bold text-gray-500 uppercase tracking-wide">{session.duration} • Mood: {session.mood}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

          </div>
        </div>
      </main>
    </div>
  );
}
