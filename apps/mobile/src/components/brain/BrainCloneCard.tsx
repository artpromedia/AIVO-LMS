/**
 * BrainCloneCard (mobile)
 * -----------------------
 * Data-bound wrapper around `BrainCloneInteractive`. Mirrors
 * `apps/web/src/components/brain/BrainCloneCard.tsx`: fetches the brain
 * state from `/api/brain/{learnerId}` (brain-svc, port 3002 via
 * `apiFetch(API.BRAIN, ...)`) and reshapes it into the `regions` and
 * `metrics` `BrainCloneInteractive` expects.
 *
 * Renders three states:
 *  - loading  → tier-themed skeleton card
 *  - empty    → friendly "Brain not built yet" prompt with CTA
 *  - ready    → the interactive brain
 */
import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { apiFetch } from '@/lib/api';
import { API } from '@/constants/api';
import { colors, radius, spacing } from '@/constants/colors';
import BrainCloneInteractive, {
  type BrainCloneMetrics,
  type BrainRegionDatum,
} from './BrainCloneInteractive';

interface BrainState {
  masteryLevels?: Record<string, number>;
  activeAccommodations?: string[];
  activeTutors?: string[];
  xaiExplanation?: {
    mastery_decisions?: {
      domain: string;
      score: number;
      display_label?: string;
    }[];
    accommodation_decisions?: {
      accommodation: string;
      display_label?: string;
      affects_domains?: string[];
    }[];
    tutor_decisions?: {
      tutor_key: string;
      reasoning?: string;
      affects_domains?: string[];
    }[];
  };
  state?: BrainState;
  updatedAt?: string;
  version?: number;
}

interface SummaryStats {
  streak?: { currentStreak: number };
  totalXp?: number;
  badgeCount?: number;
  masteryDeltaWeek?: number;
  nextMilestone?: string;
}

export interface BrainCloneCardProps {
  learnerId: string;
  learnerName: string;
  enrolledGrade?: string | number | null;
  variant?: 'card' | 'full';
  /** Optional pre-computed summary so callers can pass in cached
   *  streak/XP without an extra round-trip. */
  summary?: SummaryStats;
  /** Tap handler for the card variant's "View full brain" CTA. */
  onOpenFull?: () => void;
  /** Tap handler for the empty-state CTA (typically navigates to the
   *  brain-review / baseline assessment screen). */
  onBuildBrain?: () => void;
}

const DOMAIN_LABELS: Record<string, string> = {
  ela: 'Reading',
  english: 'Reading',
  reading: 'Reading',
  math: 'Math',
  mathematics: 'Math',
  science: 'Science',
  sel: 'Social-Emotional',
  social_emotional: 'Social-Emotional',
  social: 'Social-Emotional',
  speech: 'Communication',
  communication: 'Communication',
  language: 'Communication',
  executive_function: 'Executive Function',
  ef: 'Executive Function',
  exec: 'Executive Function',
};

function labelFor(domain: string): string {
  const key = domain.toLowerCase().replace(/[\s-]+/g, '_');
  return (
    DOMAIN_LABELS[key] ||
    domain.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
  );
}

export default function BrainCloneCard({
  learnerId,
  learnerName,
  enrolledGrade,
  variant = 'card',
  summary,
  onOpenFull,
  onBuildBrain,
}: BrainCloneCardProps) {
  const [state, setState] = useState<BrainState | null>(null);
  const [loading, setLoading] = useState(true);
  const [exists, setExists] = useState<boolean | null>(null);

  useEffect(() => {
    if (!learnerId) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    apiFetch(API.BRAIN, `/api/brain/${learnerId}`)
      .then(async (res) => {
        if (cancelled) return;
        if (res.ok) {
          const data: BrainState = await res.json();
          // The brain API returns canonical fields at the top level
          // (camelCased). A legacy `state` jsonb column also rides
          // along and may be `{}`. Prefer top-level when populated.
          const nested = data?.state;
          const hasTopLevel = Boolean(
            data && (data.masteryLevels || data.version || data.updatedAt),
          );
          const hasNested = Boolean(
            nested && (nested.masteryLevels || nested.version || nested.updatedAt),
          );
          let chosen: BrainState;
          if (hasTopLevel) chosen = data;
          else if (hasNested && nested) chosen = nested;
          else chosen = data ?? {};
          setState(chosen);
          setExists(true);
        } else {
          setExists(false);
        }
      })
      .catch(() => {
        if (!cancelled) setExists(false);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [learnerId]);

  const regions: BrainRegionDatum[] = useMemo(() => {
    if (!state) return [];
    const mastery = state.masteryLevels ?? {};
    const accommodationDecisions =
      state.xaiExplanation?.accommodation_decisions ?? [];
    const tutorDecisions = state.xaiExplanation?.tutor_decisions ?? [];

    const accomByDomain: Record<string, string[]> = {};
    for (const a of accommodationDecisions) {
      const label = a.display_label || a.accommodation;
      const domains = a.affects_domains?.length ? a.affects_domains : [];
      for (const d of domains) {
        const key = d.toLowerCase();
        accomByDomain[key] = accomByDomain[key] ?? [];
        if (!accomByDomain[key].includes(label)) accomByDomain[key].push(label);
      }
    }
    const tutorByDomain: Record<string, string[]> = {};
    for (const t of tutorDecisions) {
      const domains = t.affects_domains?.length ? t.affects_domains : [];
      for (const d of domains) {
        const key = d.toLowerCase();
        tutorByDomain[key] = tutorByDomain[key] ?? [];
        if (!tutorByDomain[key].includes(t.tutor_key)) {
          tutorByDomain[key].push(t.tutor_key);
        }
      }
    }

    return Object.entries(mastery).map(([domain, score]) => ({
      id: domain,
      domain,
      label: labelFor(domain),
      // Mastery is normally 0..1 but legacy code paths may emit 0..100.
      // Anything > 1 is treated as a percentage and divided.
      mastery:
        typeof score === 'number'
          ? score > 1
            ? score / 100
            : score
          : 0,
      lastActivity: state.updatedAt ?? null,
      accommodations: accomByDomain[domain.toLowerCase()] ?? [],
      tutors: tutorByDomain[domain.toLowerCase()] ?? [],
    }));
  }, [state]);

  const metrics: BrainCloneMetrics | undefined = useMemo(() => {
    if (!summary) return undefined;
    return {
      streakDays: summary.streak?.currentStreak,
      totalXp: summary.totalXp,
      badgeCount: summary.badgeCount,
      masteryDeltaWeek: summary.masteryDeltaWeek,
      nextMilestone: summary.nextMilestone,
    };
  }, [summary]);

  if (loading) {
    return (
      <View
        style={[styles.skeleton, variant === 'full' && styles.skeletonFull]}
        accessibilityLabel="Loading brain visualization"
      >
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  if (!exists || !state || regions.length === 0) {
    return (
      <View style={styles.empty}>
        <View style={styles.emptyIcon}>
          <Ionicons name="bulb-outline" size={26} color={colors.primary} />
        </View>
        <Text style={styles.emptyTitle}>Brain not built yet</Text>
        <Text style={styles.emptyBody}>
          Once {learnerName} finishes the baseline adventure, their personalized Brain Clone will appear here.
        </Text>
        {onBuildBrain && (
          <Pressable onPress={onBuildBrain} style={styles.emptyBtn}>
            <Ionicons name="clipboard-outline" size={14} color={colors.primary} />
            <Text style={styles.emptyBtnText}>Build the Brain</Text>
          </Pressable>
        )}
      </View>
    );
  }

  return (
    <BrainCloneInteractive
      variant={variant}
      learnerName={learnerName}
      enrolledGrade={enrolledGrade}
      regions={regions}
      metrics={metrics}
      onOpenFull={variant === 'card' ? onOpenFull : undefined}
    />
  );
}

const styles = StyleSheet.create({
  skeleton: {
    minHeight: 240,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.lg,
  },
  skeletonFull: { minHeight: 360 },
  empty: {
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    padding: spacing.lg,
    alignItems: 'center',
  },
  emptyIcon: {
    width: 48,
    height: 48,
    borderRadius: radius.lg,
    backgroundColor: colors.primary + '24',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  emptyTitle: {
    fontSize: 16,
    fontFamily: 'Nunito-ExtraBold',
    color: colors.text,
    marginBottom: 4,
  },
  emptyBody: {
    fontSize: 13,
    fontFamily: 'Nunito-Regular',
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: spacing.md,
    lineHeight: 18,
  },
  emptyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    borderRadius: radius.full,
    backgroundColor: colors.primary + '14',
    borderWidth: 1,
    borderColor: colors.primary + '60',
  },
  emptyBtnText: {
    fontSize: 12,
    fontFamily: 'Nunito-Bold',
    color: colors.primary,
  },
});
