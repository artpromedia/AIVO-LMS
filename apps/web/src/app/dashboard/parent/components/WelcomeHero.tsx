"use client";
import Link from "next/link";
import { Sun, Cloud, Moon, Sparkles, Bell } from "lucide-react";

interface WelcomeHeroProps {
  userName: string;
  unreadCount: number;
  lastVisit: string | null;
}

export function WelcomeHero({ userName, unreadCount }: WelcomeHeroProps) {
  const hour = new Date().getHours();
  const firstName = userName?.split(" ")[0] || "";

  let greeting: string;
  let subtext: string;
  let Icon = Sparkles;
  let iconColor = "text-[hsl(var(--visual-primary))]";

  if (hour >= 5 && hour < 12) {
    greeting = `Good morning, ${firstName}`;
    subtext = "Here's how your family is doing today.";
    Icon = Sun;
    iconColor = "text-[hsl(var(--visual-sel))]";
  } else if (hour >= 12 && hour < 17) {
    greeting = `Good afternoon, ${firstName}`;
    subtext = "Let's check in on today's progress.";
    Icon = Cloud;
    iconColor = "text-[hsl(var(--visual-reading))]";
  } else if (hour >= 17 && hour < 21) {
    greeting = `Good evening, ${firstName}`;
    subtext = "Let's see what happened today.";
    Icon = Moon;
    iconColor = "text-[hsl(var(--visual-primary))]";
  } else {
    greeting = `Hey ${firstName}`;
    subtext = "Quick check-in — everything's on track.";
  }

  return (
    <div className="relative overflow-hidden vi-card p-6 lg:p-8">
      <div className="flex items-start justify-between gap-4 relative z-10">
        <div className="flex items-center gap-4">
          <div className={`w-14 h-14 rounded-2xl vi-surface-soft shadow-sm flex items-center justify-center ${iconColor} shrink-0`}>
            <Icon size={28} strokeWidth={2.5} aria-hidden="true" />
          </div>
          <div>
            <h1 className="text-2xl lg:text-3xl font-heading font-bold vi-text leading-tight">
              {greeting}
            </h1>
            <p className="vi-text-muted mt-1 text-sm lg:text-base font-medium">{subtext}</p>
          </div>
        </div>
        {unreadCount > 0 && (
          <Link
            href="/dashboard/parent/inbox"
            className="hidden sm:flex items-center gap-2 px-4 py-2.5 rounded-full bg-[hsl(var(--visual-surface))] border-2 border-[hsl(var(--visual-primary)/0.3)] text-[hsl(var(--visual-primary))] text-sm font-bold hover:bg-[hsl(var(--visual-primary)/0.08)] transition flex-shrink-0 shadow-sm"
          >
            <span className="relative">
              <Bell size={18} strokeWidth={2.5} aria-hidden="true" />
              <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-[hsl(var(--visual-math))] text-white text-[10px] font-black flex items-center justify-center">
                {unreadCount > 9 ? "9+" : unreadCount}
              </span>
            </span>
            <span>Need attention</span>
          </Link>
        )}
      </div>
    </div>
  );
}
