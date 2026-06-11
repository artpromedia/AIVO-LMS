/**
 * BrainCloneInteractive (mobile)
 * ------------------------------
 * React Native counterpart to `apps/web/src/components/brain/BrainCloneInteractive.tsx`.
 * Renders the same six-region stylised brain silhouette using
 * `react-native-svg`, with the same status colours, grade math, and
 * reduced-motion handling as the web component (helpers are shared via
 * `BrainCloneInteractive.helpers.ts`).
 *
 *  - Each region is a tappable Path. Tap opens a bottom-sheet detail
 *    modal listing accommodations and recommended tutors for that
 *    domain.
 *  - Strong domains pulse via Animated opacity (native-driver friendly);
 *    pulse disabled when reduce-motion is on.
 *  - Below the SVG sits an optional metrics strip (streak, XP, weekly
 *    delta, next milestone) matching the web variant.
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AccessibilityInfo,
  Animated,
  Easing,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
  type AccessibilityChangeEventName,
} from "react-native";
import Svg, {
  Circle,
  Defs,
  Ellipse,
  Line,
  Path,
  RadialGradient,
  Stop,
  Text as SvgText,
} from "react-native-svg";
import { Ionicons } from "@expo/vector-icons";
import { colors, radius, spacing } from "@/constants/colors";
import {
  gradeToNumber,
  pulseSecondsFor,
  resolveRegions,
  statusFor,
  type BrainRegionDatum,
  type ResolvedRegion,
} from "./BrainCloneInteractive.helpers";

const AnimatedPath = Animated.createAnimatedComponent(Path);

export type { BrainRegionDatum } from "./BrainCloneInteractive.helpers";

export interface BrainCloneMetrics {
  streakDays?: number;
  totalXp?: number;
  masteryDeltaWeek?: number;
  nextMilestone?: string;
  badgeCount?: number;
}

export interface BrainCloneInteractiveProps {
  variant?: "card" | "full";
  learnerName: string;
  enrolledGrade?: string | number | null;
  regions: BrainRegionDatum[];
  metrics?: BrainCloneMetrics;
  onOpenFull?: () => void;
}

const VIEW_W = 320;
const VIEW_H = 240;

/**
 * Hook: track the current `prefers-reduced-motion` state for native and
 * web RN. Defaults to `false` and updates on subscription change.
 */
function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    let mounted = true;
    AccessibilityInfo.isReduceMotionEnabled?.()
      .then((v) => {
        if (mounted) setReduced(Boolean(v));
      })
      .catch(() => {});
    const evt: AccessibilityChangeEventName = "reduceMotionChanged";
    const sub = AccessibilityInfo.addEventListener(evt, (v) => setReduced(Boolean(v)));
    return () => {
      mounted = false;
      sub?.remove?.();
    };
  }, []);
  return reduced;
}

interface RegionPathProps {
  region: ResolvedRegion;
  enrolled: number;
  reduced: boolean;
  onPress: (id: string) => void;
}

function RegionPath({ region, enrolled, reduced, onPress }: RegionPathProps) {
  const status = statusFor(region.mastery, enrolled);
  const pulse = pulseSecondsFor(region.mastery);
  const animate = !reduced && pulse > 0;
  const opacity = useRef(new Animated.Value(0.85)).current;

  useEffect(() => {
    if (!animate) {
      opacity.setValue(0.85);
      return;
    }
    const ms = Math.round(pulse * 1000);
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, {
          toValue: 1,
          duration: ms / 2,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 0.78,
          duration: ms / 2,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [animate, pulse, opacity]);

  return (
    <>
      <AnimatedPath
        d={region.d}
        fill={status.fill}
        stroke={status.ring}
        strokeWidth={1.5}
        opacity={opacity}
        onPress={() => onPress(region.id)}
      />
      <Circle
        cx={region.cx}
        cy={region.cy}
        r={3}
        fill={status.ring}
        opacity={status.band === "unknown" ? 0.4 : 0.95}
        onPress={() => onPress(region.id)}
      />
      <Line
        x1={region.cx}
        y1={region.cy}
        x2={region.labelAnchor === "end" ? region.labelX - 4 : region.labelX + 4}
        y2={region.labelY - 4}
        stroke="rgba(124,58,237,0.35)"
        strokeWidth={0.75}
        strokeDasharray="1.5 2"
      />
      <SvgText
        x={region.labelX}
        y={region.labelY}
        textAnchor={region.labelAnchor}
        fontSize="10"
        fontWeight="700"
        fill={colors.text}
      >
        {region.label}
      </SvgText>
      <SvgText
        x={region.labelX}
        y={region.labelY + 12}
        textAnchor={region.labelAnchor}
        fontSize="9"
        fill={colors.textSecondary}
      >
        {status.band === "unknown"
          ? "no data"
          : `Gr ${(region.mastery * Math.max(enrolled, 1)).toFixed(1)}`}
      </SvgText>
    </>
  );
}

interface DetailSheetProps {
  region: ResolvedRegion | null;
  enrolled: number;
  onClose: () => void;
}

function DetailSheet({ region, enrolled, onClose }: DetailSheetProps) {
  if (!region) return null;
  const status = statusFor(region.mastery, enrolled);
  return (
    <Modal
      visible
      transparent
      animationType="slide"
      onRequestClose={onClose}
      accessibilityViewIsModal
    >
      <View style={styles.scrim}>
        <Pressable style={styles.scrimTap} onPress={onClose} accessibilityLabel="Close" />
        <View style={styles.sheet}>
          <View style={styles.sheetHeader}>
            <View style={styles.sheetTitleRow}>
              <View style={[styles.statusDot, { backgroundColor: status.ring }]} />
              <Text style={styles.sheetTitle}>{region.label}</Text>
            </View>
            <Pressable hitSlop={10} onPress={onClose} accessibilityLabel="Close details">
              <Ionicons name="close" size={22} color={colors.textSecondary} />
            </Pressable>
          </View>
          <Text style={styles.sheetBand}>{status.label}</Text>
          <Text style={styles.sheetDescription}>{status.description}</Text>
          {region.lastActivity && (
            <Text style={styles.sheetMeta}>
              Last activity: {new Date(region.lastActivity).toLocaleString()}
            </Text>
          )}
          {region.accommodations.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>Accommodations affecting this area</Text>
              <View style={styles.chipRow}>
                {region.accommodations.map((a) => (
                  <View key={a} style={styles.chip}>
                    <Text style={styles.chipText}>{a.replace(/_/g, " ")}</Text>
                  </View>
                ))}
              </View>
            </View>
          )}
          {region.tutors.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>Recommended tutors</Text>
              <View style={styles.chipRow}>
                {region.tutors.map((t) => (
                  <View key={t} style={styles.chip}>
                    <Text style={styles.chipText}>{t}</Text>
                  </View>
                ))}
              </View>
            </View>
          )}
        </View>
      </View>
    </Modal>
  );
}

interface MetricCellProps {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: string;
}

function MetricCell({ icon, label, value }: MetricCellProps) {
  return (
    <View style={styles.metricCell}>
      <View style={styles.metricIconRow}>
        <Ionicons name={icon} size={14} color={colors.primary} />
        <Text style={styles.metricLabel}>{label}</Text>
      </View>
      <Text style={styles.metricValue} numberOfLines={1}>
        {value}
      </Text>
    </View>
  );
}

export default function BrainCloneInteractive({
  variant = "card",
  learnerName,
  enrolledGrade,
  regions: regionsInput,
  metrics,
  onOpenFull,
}: BrainCloneInteractiveProps) {
  const enrolled = gradeToNumber(enrolledGrade);
  const reducedMotion = useReducedMotion();
  const regions = useMemo(() => resolveRegions(regionsInput), [regionsInput]);
  const [activeId, setActiveId] = useState<string | null>(null);

  const handleRegionPress = useCallback((id: string) => setActiveId(id), []);
  const closeDetail = useCallback(() => setActiveId(null), []);

  const activeRegion = activeId ? (regions.find((r) => r.id === activeId) ?? null) : null;

  const isCard = variant === "card";
  const svgHeight = isCard ? 220 : 320;

  return (
    <View
      style={styles.root}
      accessibilityLabel={`${learnerName}'s Brain Clone — interactive map of learning domains`}
    >
      <View style={[styles.canvas, isCard && styles.canvasCard]}>
        <Svg viewBox={`0 0 ${VIEW_W} ${VIEW_H}`} width="100%" height={svgHeight}>
          <Defs>
            <RadialGradient id="bci-glow" cx="50%" cy="45%" r="55%">
              <Stop offset="0%" stopColor={colors.primary} stopOpacity={0.18} />
              <Stop offset="100%" stopColor={colors.primary} stopOpacity={0} />
            </RadialGradient>
          </Defs>
          <Ellipse cx={160} cy={125} rx={140} ry={95} fill="url(#bci-glow)" />
          <Path
            d="M60,120 Q40,80 80,55 Q110,38 150,42 Q195,32 235,55 Q275,80 270,125 Q278,170 240,195 Q205,215 160,210 Q115,215 80,195 Q42,170 60,120 Z"
            fill={colors.surface}
            stroke="rgba(124,58,237,0.38)"
            strokeWidth={1.5}
          />
          <Path
            d="M160,46 Q156,120 162,210"
            fill="none"
            stroke="rgba(124,58,237,0.30)"
            strokeWidth={1}
            strokeDasharray="2 4"
          />
          {regions.map((region) => (
            <RegionPath
              key={region.id}
              region={region}
              enrolled={enrolled}
              reduced={reducedMotion}
              onPress={handleRegionPress}
            />
          ))}
        </Svg>
      </View>

      {metrics && (
        <View
          style={[styles.metricGrid, !isCard && styles.metricGridFull]}
          accessibilityLabel="Key metrics"
        >
          <MetricCell
            icon="flame-outline"
            label="Streak"
            value={
              metrics.streakDays != null
                ? `${metrics.streakDays} day${metrics.streakDays === 1 ? "" : "s"}`
                : "—"
            }
          />
          <MetricCell
            icon="star-outline"
            label="XP"
            value={metrics.totalXp != null ? metrics.totalXp.toLocaleString() : "—"}
          />
          {!isCard && (
            <MetricCell
              icon="trending-up-outline"
              label="This week"
              value={
                metrics.masteryDeltaWeek != null
                  ? `${metrics.masteryDeltaWeek >= 0 ? "+" : ""}${(
                      metrics.masteryDeltaWeek * 100
                    ).toFixed(0)} pp`
                  : "—"
              }
            />
          )}
          {!isCard && (
            <MetricCell
              icon="sparkles-outline"
              label="Next milestone"
              value={metrics.nextMilestone || "Keep practising"}
            />
          )}
        </View>
      )}

      {isCard && onOpenFull && (
        <Pressable accessibilityRole="button" onPress={onOpenFull} style={styles.openFullBtn}>
          <Ionicons name="bulb-outline" size={14} color={colors.primary} />
          <Text style={styles.openFullText}>View full brain</Text>
        </Pressable>
      )}

      <DetailSheet region={activeRegion} enrolled={enrolled} onClose={closeDetail} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { width: "100%" },
  canvas: {
    borderRadius: radius.xl,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(124,58,237,0.28)",
    backgroundColor: colors.surface,
    paddingVertical: spacing.sm,
  },
  canvasCard: {},
  metricGrid: {
    marginTop: spacing.sm,
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
  },
  metricGridFull: {},
  metricCell: {
    flexBasis: "48%",
    flexGrow: 1,
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    paddingHorizontal: spacing.sm,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: colors.border,
  },
  metricIconRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginBottom: 2,
  },
  metricLabel: {
    fontSize: 11,
    fontFamily: "Nunito-SemiBold",
    color: colors.textSecondary,
  },
  metricValue: {
    fontSize: 14,
    fontFamily: "Nunito-Bold",
    color: colors.text,
  },
  openFullBtn: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    borderRadius: radius.full,
    backgroundColor: colors.primary + "14",
    borderWidth: 1,
    borderColor: colors.primary + "60",
  },
  openFullText: {
    fontSize: 12,
    fontFamily: "Nunito-Bold",
    color: colors.primary,
  },
  scrim: {
    flex: 1,
    backgroundColor: "rgba(20,20,30,0.45)",
    justifyContent: "flex-end",
  },
  scrimTap: { flex: 1 },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.xxl,
    borderTopRightRadius: radius.xxl,
    padding: spacing.lg,
    paddingBottom: spacing.xl,
  },
  sheetHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    marginBottom: 4,
  },
  sheetTitleRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  statusDot: { width: 10, height: 10, borderRadius: 5 },
  sheetTitle: {
    fontSize: 18,
    fontFamily: "Nunito-ExtraBold",
    color: colors.text,
  },
  sheetBand: {
    fontSize: 12,
    fontFamily: "Nunito-SemiBold",
    color: colors.textSecondary,
    marginBottom: spacing.sm,
  },
  sheetDescription: {
    fontSize: 14,
    fontFamily: "Nunito-Regular",
    color: colors.text,
    marginBottom: spacing.sm,
    lineHeight: 20,
  },
  sheetMeta: {
    fontSize: 12,
    fontFamily: "Nunito-Regular",
    color: colors.textSecondary,
    marginBottom: spacing.md,
  },
  section: { marginTop: spacing.md },
  sectionLabel: {
    fontSize: 11,
    fontFamily: "Nunito-Bold",
    color: colors.textSecondary,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  chip: {
    backgroundColor: colors.primary + "1F",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radius.full,
  },
  chipText: {
    fontSize: 12,
    fontFamily: "Nunito-SemiBold",
    color: colors.primary,
  },
});
