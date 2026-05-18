"use client";
import { useRouter } from "next/navigation";
import {
  Brain,
  ClipboardList,
  Sparkles,
  ChevronRight,
  PartyPopper,
  type LucideIcon,
} from "lucide-react";

interface QuickAction {
  label: string;
  description: string;
  href: string;
  Icon: LucideIcon;
  priority: number;
  iconWrap: string;
  card: string;
}

interface QuickActionsProps {
  learners: Array<{
    id: string;
    name: string;
    functioningLevel?: string;
  }>;
  pendingReviews: Record<string, boolean>;
  hasBrain: Record<string, boolean>;
  baselineCompleted: Record<string, boolean>;
}

export function QuickActions({
  learners,
  pendingReviews,
  hasBrain,
  baselineCompleted,
}: QuickActionsProps) {
  const router = useRouter();

  const actions: QuickAction[] = [];

  for (const l of learners) {
    if (pendingReviews[l.id]) {
      actions.push({
        label: `Review ${l.name}'s Brain Profile`,
        description: "AIVO updated the brain profile and needs your approval.",
        href: `/dashboard/parent/learner/${l.id}/brain-review`,
        Icon: Brain,
        priority: 1,
        iconWrap: "bg-[hsl(var(--visual-surface))] text-[hsl(var(--visual-sel))]",
        card: "bg-[hsl(var(--visual-sel)/0.08)] border-[hsl(var(--visual-sel)/0.3)] hover:border-[hsl(var(--visual-sel)/0.5)]",
      });
    }

    if (!l.functioningLevel) {
      actions.push({
        label: `Complete ${l.name}'s Assessment`,
        description: "Help us understand your child by completing the initial assessment (10 min).",
        href: `/dashboard/parent/learner/${l.id}/assessment`,
        Icon: ClipboardList,
        priority: 2,
        iconWrap: "bg-[hsl(var(--visual-surface))] text-[hsl(var(--visual-reading))]",
        card: "bg-[hsl(var(--visual-reading)/0.08)] border-[hsl(var(--visual-reading)/0.3)] hover:border-[hsl(var(--visual-reading)/0.5)]",
      });
    } else if (baselineCompleted[l.id] && !hasBrain[l.id] && !pendingReviews[l.id]) {
      actions.push({
        label: `${l.name}'s brain is being built!`,
        description: "We'll notify you when it's ready for review.",
        href: `/dashboard/parent/learner/${l.id}`,
        Icon: Sparkles,
        priority: 3,
        iconWrap: "bg-[hsl(var(--visual-surface))] text-[hsl(var(--visual-science))]",
        card: "bg-[hsl(var(--visual-science)/0.08)] border-[hsl(var(--visual-science)/0.3)] hover:border-[hsl(var(--visual-science)/0.5)]",
      });
    }
  }

  actions.sort((a, b) => a.priority - b.priority);
  const topActions = actions.slice(0, 3);

  if (topActions.length === 0) {
    return (
      <div className="flex items-center gap-3 vi-card p-5 bg-[hsl(var(--visual-science)/0.08)] border-[hsl(var(--visual-science)/0.3)]">
        <div className="w-12 h-12 rounded-2xl bg-[hsl(var(--visual-surface))] flex items-center justify-center text-[hsl(var(--visual-science))] shadow-sm shrink-0">
          <PartyPopper size={24} strokeWidth={2.5} aria-hidden="true" />
        </div>
        <div>
          <p className="text-[hsl(var(--visual-science))] font-heading font-bold text-base">
            All caught up!
          </p>
          <p className="vi-text-muted text-sm font-medium">Everyone is on track.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <h2 className="text-lg font-heading font-bold vi-text flex items-center gap-2">
        <Sparkles
          className="text-[hsl(var(--visual-primary))]"
          size={20}
          strokeWidth={2.5}
          aria-hidden="true"
        />
        What needs your attention
      </h2>
      {topActions.map((action, i) => (
        <button
          key={i}
          onClick={() => router.push(action.href)}
          className={`group w-full text-left ${action.card} rounded-2xl p-4 border-2 hover:shadow-md transition-all`}
          style={{ minHeight: 44 }}
        >
          <div className="flex items-center gap-3">
            <div
              className={`w-12 h-12 rounded-2xl ${action.iconWrap} flex items-center justify-center shadow-sm shrink-0`}
            >
              <action.Icon size={22} strokeWidth={2.5} aria-hidden="true" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-heading font-bold vi-text">{action.label}</p>
              <p className="text-xs vi-text-muted mt-0.5 font-medium">{action.description}</p>
            </div>
            <ChevronRight
              className="vi-text-muted group-hover:vi-text group-hover:translate-x-1 transition-all shrink-0"
              size={20}
              strokeWidth={2.5}
              aria-hidden="true"
            />
          </div>
        </button>
      ))}
    </div>
  );
}
