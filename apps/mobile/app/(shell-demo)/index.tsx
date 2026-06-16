import React, { useMemo, useState } from "react";
import { View, Text, StyleSheet, ScrollView, Pressable } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { RoleAwareTabBar, RoleSwitcherSheet, LockedScreenMobile } from "@aivo/mobile-ui";
import {
  NAV_AREA_META,
  ROLES,
  ROLE_META,
  getPermission,
  getAreasForRole,
  type NavArea,
  type Role,
} from "@aivo/nav";
import { colors } from "@/constants/colors";

/**
 * Map our NavArea ids to Ionicons glyphs. Mobile-ui itself stays
 * icon-library-agnostic; this mapping lives in the host so apps
 * can swap in a different glyph set if needed.
 */
const ICONS: Record<NavArea, keyof typeof Ionicons.glyphMap> = {
  home: "sparkles-outline",
  learners: "people-outline",
  subjects: "library-outline",
  baseline: "flag-outline",
  lessons: "book-outline",
  homeworkHelper: "color-wand-outline",
  aiTutor: "chatbubbles-outline",
  progress: "trending-up-outline",
  iep: "document-text-outline",
  messages: "chatbox-outline",
  approvals: "checkbox-outline",
  billing: "card-outline",
  settings: "settings-outline",
  admin: "business-outline",
  safety: "shield-checkmark-outline",
  reports: "stats-chart-outline",
};

export default function ShellDemoScreen() {
  const [role, setRole] = useState<Role>("learner");
  const [activeArea, setActiveArea] = useState<NavArea>("home");
  const [switcherOpen, setSwitcherOpen] = useState(false);
  const [lockedArea, setLockedArea] = useState<NavArea | null>(null);
  const [stepUpRole, setStepUpRole] = useState<Role | null>(null);

  const lockedAreas = useMemo(
    () =>
      getAreasForRole(role, { includeLocked: true }).filter(
        (a) => getPermission(role, a).access === "locked",
      ),
    [role],
  );

  if (lockedArea) {
    return (
      <SafeAreaView style={styles.root} edges={["top", "bottom"]}>
        <View style={styles.lockedHeader}>
          <Pressable accessibilityRole="button" onPress={() => setLockedArea(null)} hitSlop={12}>
            <Text style={styles.backLink}>← Back to demo</Text>
          </Pressable>
        </View>
        <LockedScreenMobile
          role={role}
          area={lockedArea}
          renderIcon={(a) => <Ionicons name={ICONS[a]} size={40} color={colors.primary} />}
        />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.root} edges={["top"]}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.eyebrow}>Shell demo</Text>
        <Text style={styles.title}>AIVO mobile shell</Text>
        <Text style={styles.subtitle}>
          The tab bar below is rendered by @aivo/mobile-ui/shell from the @aivo/nav registry —
          change the role to see how the bar adapts.
        </Text>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Signed in as</Text>
          <View style={styles.rolePill}>
            <Text style={styles.rolePillText}>{ROLE_META[role].label}</Text>
          </View>
          <Text style={styles.cardBody}>{ROLE_META[role].description}</Text>
          <Pressable
            style={({ pressed }) => [styles.button, pressed && styles.buttonPressed]}
            onPress={() => setSwitcherOpen(true)}
            accessibilityRole="button"
          >
            <Text style={styles.buttonText}>Switch role</Text>
          </Pressable>
        </View>

        <Text style={styles.sectionTitle}>Active area</Text>
        <Text style={styles.sectionBody}>
          {NAV_AREA_META[activeArea].label} — {NAV_AREA_META[activeArea].description}
        </Text>

        {lockedAreas.length > 0 && (
          <>
            <Text style={styles.sectionTitle}>Locked areas for this role</Text>
            <View style={styles.lockedList}>
              {lockedAreas.map((a) => (
                <Pressable
                  key={a}
                  style={({ pressed }) => [styles.lockedRow, pressed && styles.lockedRowPressed]}
                  onPress={() => setLockedArea(a)}
                  accessibilityRole="button"
                  accessibilityLabel={`Preview locked screen for ${NAV_AREA_META[a].label}`}
                >
                  <Ionicons name={ICONS[a]} size={20} color={colors.textSecondary} />
                  <Text style={styles.lockedRowLabel}>{NAV_AREA_META[a].label}</Text>
                  <Ionicons name="lock-closed" size={14} color={colors.textSecondary} />
                </Pressable>
              ))}
            </View>
          </>
        )}

        {stepUpRole && (
          <View style={styles.stepUpBanner}>
            <Ionicons name="shield-checkmark" size={18} color={colors.white} />
            <Text style={styles.stepUpText}>
              Step-up required to enter {ROLE_META[stepUpRole].label}. In the real app a biometric /
              PIN prompt would appear here.
            </Text>
            <Pressable accessibilityRole="button" onPress={() => setStepUpRole(null)}>
              <Text style={styles.stepUpDismiss}>OK</Text>
            </Pressable>
          </View>
        )}
      </ScrollView>

      <RoleAwareTabBar
        role={role}
        activeArea={activeArea}
        onSelect={(area) => setActiveArea(area)}
        renderIcon={(area, active) => (
          <Ionicons name={ICONS[area]} size={22} color={active ? colors.primary : colors.textSecondary} />
        )}
      />

      <RoleSwitcherSheet
        visible={switcherOpen}
        currentRole={role}
        options={ROLES.map((id) => ({ id, available: true }))}
        onClose={() => setSwitcherOpen(false)}
        onSelect={(next) => {
          setRole(next);
          setActiveArea("home");
          setSwitcherOpen(false);
        }}
        onStepUp={(next) => {
          setStepUpRole(next);
          // For the demo we skip the real prompt and just complete after a tick.
          setTimeout(() => {
            setRole(next);
            setActiveArea("home");
            setStepUpRole(null);
          }, 600);
          setSwitcherOpen(false);
        }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  content: { padding: 20, paddingBottom: 40, gap: 12 },
  eyebrow: {
    fontSize: 12,
    color: colors.textSecondary,
    textTransform: "uppercase",
    letterSpacing: 1.2,
    fontWeight: "600",
  },
  title: { fontSize: 28, fontWeight: "700", color: colors.text },
  subtitle: { fontSize: 14, color: colors.textSecondary, lineHeight: 20, marginBottom: 4 },
  card: {
    backgroundColor: colors.white,
    borderRadius: 20,
    padding: 16,
    gap: 8,
    borderWidth: 1,
    borderColor: colors.border,
  },
  cardTitle: {
    fontSize: 12,
    color: colors.textSecondary,
    textTransform: "uppercase",
    letterSpacing: 1,
    fontWeight: "600",
  },
  rolePill: {
    alignSelf: "flex-start",
    backgroundColor: colors.primaryLight,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
  },
  rolePillText: { color: colors.primary, fontWeight: "700", fontSize: 14 },
  cardBody: { fontSize: 13, color: colors.textSecondary, lineHeight: 19 },
  button: {
    alignSelf: "flex-start",
    marginTop: 8,
    backgroundColor: colors.primary,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 999,
  },
  buttonPressed: { opacity: 0.85 },
  buttonText: { color: colors.white, fontWeight: "700", fontSize: 14 },
  sectionTitle: {
    marginTop: 16,
    fontSize: 13,
    color: colors.textSecondary,
    textTransform: "uppercase",
    letterSpacing: 1,
    fontWeight: "600",
  },
  sectionBody: { fontSize: 14, color: colors.text, lineHeight: 20 },
  lockedList: { gap: 8 },
  lockedRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: colors.white,
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  lockedRowPressed: { opacity: 0.7 },
  lockedRowLabel: { flex: 1, fontSize: 14, color: colors.text, fontWeight: "600" },
  lockedHeader: { padding: 16 },
  backLink: { color: colors.primary, fontWeight: "700", fontSize: 14 },
  stepUpBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginTop: 12,
    padding: 12,
    backgroundColor: colors.accent,
    borderRadius: 14,
  },
  stepUpText: { flex: 1, color: colors.white, fontSize: 13, lineHeight: 18 },
  stepUpDismiss: { color: colors.white, fontWeight: "700", fontSize: 14 },
});
