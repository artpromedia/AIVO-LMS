import React, { useState } from "react";
import {
  Play,
  CheckCircle2,
  Clock,
  Calendar,
  AlertCircle,
  Sparkles,
  Brain,
  Eye,
  Settings,
  ChevronDown,
  ChevronRight,
  Zap,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
  CardFooter,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import "./_group.css";

// Helper components for the focused design language
const Module = ({ children, isFocused, isFocusModeActive, onClick }: any) => {
  const isBlurred = isFocusModeActive && !isFocused;
  return (
    <div
      className={`relative w-full max-w-2xl mx-auto mb-16 p-8 rounded-3xl border-2 border-border bg-card shadow-sm transition-all duration-300 ease-in-out ${isBlurred ? "opacity-30 grayscale pointer-events-none scale-95" : "opacity-100 scale-100"}`}
      onClick={onClick}
    >
      {children}
    </div>
  );
};

export function Dashboard() {
  const [focusMode, setFocusMode] = useState(false);
  const [activeModule, setActiveModule] = useState<string | null>("today");

  const [brainExpanded, setBrainExpanded] = useState(false);
  const [sessionsExpanded, setSessionsExpanded] = useState(false);

  const handleModuleClick = (id: string) => {
    if (focusMode && activeModule !== id) return;
    setActiveModule(id);
  };

  return (
    <div className="min-h-screen bg-background text-foreground pb-24 font-sans">
      {/* Header / Chrome */}
      <header className="sticky top-0 z-50 bg-background/80 backdrop-blur-md border-b border-border/50 px-6 py-4 mb-12">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Avatar className="h-12 w-12 border-2 border-primary/20">
              <AvatarImage src="/__mockup/images/nd-focused-avatar.png" alt="Leo" />
              <AvatarFallback>Leo</AvatarFallback>
            </Avatar>
            <div>
              <h1 className="text-xl font-bold tracking-tight">Leo's Dashboard</h1>
              <div className="flex items-center gap-2 mt-1">
                <Badge
                  variant="secondary"
                  className="text-xs bg-primary/10 text-primary hover:bg-primary/20"
                >
                  Level 3
                </Badge>
                <Badge variant="outline" className="text-xs text-muted-foreground border-border">
                  Low Sensory
                </Badge>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-4 bg-secondary/50 px-4 py-2 rounded-full border border-border">
            <Eye className={`w-4 h-4 ${focusMode ? "text-primary" : "text-muted-foreground"}`} />
            <Label htmlFor="focus-mode" className="text-sm font-medium cursor-pointer">
              Focus Mode
            </Label>
            <Switch
              id="focus-mode"
              checked={focusMode}
              onCheckedChange={(checked) => {
                setFocusMode(checked);
                if (checked && !activeModule) setActiveModule("today");
              }}
            />
          </div>
        </div>
      </header>

      <main className="px-6 flex flex-col gap-8">
        {/* Module 1: Recommended Next Action (Always prominent) */}
        <Module
          id="next"
          isFocused={activeModule === "next"}
          isFocusModeActive={focusMode}
          onClick={() => handleModuleClick("next")}
        >
          <div className="flex flex-col gap-6">
            <div>
              <p className="text-sm font-semibold text-primary uppercase tracking-wider mb-2">
                Up Next
              </p>
              <h2 className="text-4xl font-bold tracking-tight">Time for Math with Atlas</h2>
              <p className="text-lg text-muted-foreground mt-3">
                Leo learns best when he tackles math first thing. This 15-minute session focuses on
                fractions.
              </p>
            </div>

            <div className="flex items-center gap-4 bg-secondary/30 p-4 rounded-2xl border border-border">
              <Clock className="w-5 h-5 text-muted-foreground" />
              <span className="text-sm font-medium text-foreground">15 minutes</span>
              <div className="w-1 h-1 rounded-full bg-border"></div>
              <span className="text-sm text-muted-foreground">Focus required: Medium</span>
            </div>

            <div className="mt-4 flex justify-start">
              <Button
                size="lg"
                className="h-16 px-8 text-lg rounded-2xl bg-primary hover:bg-primary/90 text-primary-foreground shadow-lg shadow-primary/25 group"
              >
                <Play className="w-6 h-6 mr-3 group-hover:scale-110 transition-transform" />
                Start Session
              </Button>
            </div>
          </div>
        </Module>

        {/* Module 2: Today Snapshot */}
        <Module
          id="today"
          isFocused={activeModule === "today"}
          isFocusModeActive={focusMode}
          onClick={() => handleModuleClick("today")}
        >
          <div className="flex flex-col gap-6">
            <div>
              <p className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                Today's Progress
              </p>
              <h2 className="text-3xl font-bold tracking-tight">
                Leo has completed 1 of 3 sessions.
              </h2>
            </div>

            <div className="space-y-4">
              <div className="flex justify-between items-end">
                <div className="space-y-1">
                  <span className="text-5xl font-bold text-foreground">24</span>
                  <span className="text-lg text-muted-foreground block">minutes learned</span>
                </div>
                <div className="space-y-1 text-right">
                  <span className="text-3xl font-bold text-foreground flex items-center justify-end gap-2">
                    <Zap className="w-6 h-6 text-yellow-500 fill-yellow-500" /> 5
                  </span>
                  <span className="text-sm text-muted-foreground block">day streak</span>
                </div>
              </div>
              <Progress value={33} className="h-4 rounded-full bg-secondary [&>div]:bg-primary" />
            </div>

            <div className="bg-green-500/10 border border-green-500/20 p-4 rounded-2xl flex items-start gap-4">
              <CheckCircle2 className="w-6 h-6 text-green-600 shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-green-900 dark:text-green-400">
                  Great focus this morning!
                </p>
                <p className="text-sm text-green-800/80 dark:text-green-500/80 mt-1">
                  Leo stayed engaged for the entire 24-minute reading block with zero redirects.
                </p>
              </div>
            </div>
          </div>
        </Module>

        {/* Module 3: Active Tutors */}
        <Module
          id="tutors"
          isFocused={activeModule === "tutors"}
          isFocusModeActive={focusMode}
          onClick={() => handleModuleClick("tutors")}
        >
          <div className="flex flex-col gap-6">
            <div>
              <p className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                Active Tutors
              </p>
              <h2 className="text-3xl font-bold tracking-tight">Leo's Support Team</h2>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="p-4 rounded-2xl border border-border bg-card flex flex-col items-center text-center gap-3">
                <Avatar className="h-20 w-20">
                  <AvatarImage src="/__mockup/images/nd-focused-tutor-1.png" />
                  <AvatarFallback>AT</AvatarFallback>
                </Avatar>
                <div>
                  <p className="font-bold text-foreground">Atlas</p>
                  <p className="text-xs text-muted-foreground mt-1">Math & Logic</p>
                </div>
                <Badge
                  variant="outline"
                  className="mt-auto bg-green-500/10 text-green-700 border-none"
                >
                  Active today
                </Badge>
              </div>
              <div className="p-4 rounded-2xl border border-border bg-card flex flex-col items-center text-center gap-3">
                <Avatar className="h-20 w-20">
                  <AvatarImage src="/__mockup/images/nd-focused-tutor-3.png" />
                  <AvatarFallback>MU</AvatarFallback>
                </Avatar>
                <div>
                  <p className="font-bold text-foreground">Muse</p>
                  <p className="text-xs text-muted-foreground mt-1">Creative Writing</p>
                </div>
                <Badge
                  variant="outline"
                  className="mt-auto bg-secondary text-muted-foreground border-none"
                >
                  Yesterday
                </Badge>
              </div>
              <div className="p-4 rounded-2xl border border-border bg-card flex flex-col items-center text-center gap-3">
                <Avatar className="h-20 w-20">
                  <AvatarImage src="/__mockup/images/nd-focused-tutor-4.png" />
                  <AvatarFallback>NO</AvatarFallback>
                </Avatar>
                <div>
                  <p className="font-bold text-foreground">Nova</p>
                  <p className="text-xs text-muted-foreground mt-1">Science</p>
                </div>
                <Badge
                  variant="outline"
                  className="mt-auto bg-secondary text-muted-foreground border-none"
                >
                  2 days ago
                </Badge>
              </div>
              <div className="p-4 rounded-2xl border border-border bg-card flex flex-col items-center text-center gap-3">
                <Avatar className="h-20 w-20">
                  <AvatarImage src="/__mockup/images/nd-focused-tutor-2.png" />
                  <AvatarFallback>SP</AvatarFallback>
                </Avatar>
                <div>
                  <p className="font-bold text-foreground">Spark</p>
                  <p className="text-xs text-muted-foreground mt-1">Executive Function</p>
                </div>
                <Badge
                  variant="outline"
                  className="mt-auto bg-secondary text-muted-foreground border-none"
                >
                  Always on
                </Badge>
              </div>
            </div>

            <Button variant="outline" className="w-full h-12 rounded-xl mt-2 border-border">
              Manage Tutors
            </Button>
          </div>
        </Module>

        {/* Module 4: Brain-Clone Progress */}
        <Module
          id="brain"
          isFocused={activeModule === "brain"}
          isFocusModeActive={focusMode}
          onClick={() => handleModuleClick("brain")}
        >
          <div className="flex flex-col gap-6">
            <div>
              <p className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                Brain-Clone Personalization
              </p>
              <h2 className="text-3xl font-bold tracking-tight">
                The AI is learning how Leo thinks.
              </h2>
              <p className="text-base text-muted-foreground mt-3">
                AIVO's model adapts daily to Leo's unique processing style.
              </p>
            </div>

            <Collapsible open={brainExpanded} onOpenChange={setBrainExpanded} className="w-full">
              {!brainExpanded && (
                <CollapsibleTrigger asChild>
                  <Button
                    variant="ghost"
                    className="w-full h-14 justify-between rounded-xl bg-secondary/30 hover:bg-secondary/50"
                  >
                    <span className="font-medium flex items-center">
                      <Brain className="w-4 h-4 mr-2" /> View Model Insights
                    </span>
                    <ChevronDown className="w-4 h-4" />
                  </Button>
                </CollapsibleTrigger>
              )}

              <CollapsibleContent className="space-y-4 animate-in slide-in-from-top-2 duration-300">
                <div className="space-y-6 bg-secondary/20 p-6 rounded-2xl border border-border">
                  <div>
                    <h4 className="font-semibold mb-3 flex items-center text-sm uppercase tracking-wide text-muted-foreground">
                      <CheckCircle2 className="w-4 h-4 mr-2 text-green-500" /> Confirmed Patterns
                    </h4>
                    <ul className="space-y-3">
                      <li className="text-sm bg-background p-3 rounded-lg border border-border">
                        Responds best to visual instructions before text.
                      </li>
                      <li className="text-sm bg-background p-3 rounded-lg border border-border">
                        Needs 2-minute movement breaks every 15 minutes.
                      </li>
                      <li className="text-sm bg-background p-3 rounded-lg border border-border">
                        Frustration drops when tone is kept highly predictable.
                      </li>
                    </ul>
                  </div>

                  <div>
                    <h4 className="font-semibold mb-3 flex items-center text-sm uppercase tracking-wide text-muted-foreground">
                      <Sparkles className="w-4 h-4 mr-2 text-blue-500" /> Currently Testing
                    </h4>
                    <ul className="space-y-3">
                      <li className="text-sm bg-background p-3 rounded-lg border border-border border-l-4 border-l-blue-500">
                        Does gamification (points/badges) increase or decrease focus?
                      </li>
                      <li className="text-sm bg-background p-3 rounded-lg border border-border border-l-4 border-l-blue-500">
                        Optimal volume for text-to-speech audio.
                      </li>
                    </ul>
                  </div>

                  <Button
                    variant="ghost"
                    className="w-full justify-between"
                    onClick={() => setBrainExpanded(false)}
                  >
                    <span>Hide Insights</span>
                    <ChevronDown className="w-4 h-4 rotate-180" />
                  </Button>
                </div>
              </CollapsibleContent>
            </Collapsible>
          </div>
        </Module>

        {/* Module 5: Settings & Profile */}
        <Module
          id="settings"
          isFocused={activeModule === "settings"}
          isFocusModeActive={focusMode}
          onClick={() => handleModuleClick("settings")}
        >
          <div className="flex flex-col gap-6">
            <div>
              <p className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                Configuration
              </p>
              <h2 className="text-3xl font-bold tracking-tight">Quick Settings</h2>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between p-4 rounded-xl border border-border hover:bg-secondary/30 cursor-pointer transition-colors">
                <div>
                  <p className="font-semibold text-foreground">Sensory Profile</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    Currently set to Low Stimulation.
                  </p>
                </div>
                <ChevronRight className="w-5 h-5 text-muted-foreground" />
              </div>

              <div className="flex items-center justify-between p-4 rounded-xl border border-border hover:bg-secondary/30 cursor-pointer transition-colors">
                <div>
                  <p className="font-semibold text-foreground">Schedule & Routine</p>
                  <p className="text-sm text-muted-foreground mt-1">3 sessions/day, 15m each.</p>
                </div>
                <ChevronRight className="w-5 h-5 text-muted-foreground" />
              </div>

              <div className="flex items-center justify-between p-4 rounded-xl border border-border hover:bg-secondary/30 cursor-pointer transition-colors">
                <div>
                  <p className="font-semibold text-foreground">Accessibility Needs</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    Dyslexia font, High contrast.
                  </p>
                </div>
                <ChevronRight className="w-5 h-5 text-muted-foreground" />
              </div>
            </div>
          </div>
        </Module>
      </main>
    </div>
  );
}
