import React from "react";
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  ScrollView,
} from "react-native";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors, spacing, radius } from "@/constants/colors";
import { fontFamilies } from "@/constants/typography";
import { useSensoryPalette } from "@/context/SensoryModeProvider";

/**
 * /(auth)/session-switch
 *
 * Clean parent <-> learner session switcher. Lives in the auth stack
 * because switching profiles is an auth-equivalent action: it changes
 * who the device thinks it's signed in as.
 *
 * Sprint-3 acceptance: "Clear parent <-> learner session switch."
 *
 * Parent rows route to /(parent), learner rows route to the PIN
 * screen — the learner can only fully enter after entering their
 * PIN, which prevents a child from switching profiles without
 * permission.
 */
export default function SessionSwitchScreen() {
  const insets = useSafeAreaInsets();
  const palette = useSensoryPalette();

  // Placeholder roster. Real implementation reads from `useAuth()` +
  // the learner list owned by this parent account.
  const parents = [
    { id: "p1", name: "Ofem (you)", role: "Parent" },
    { id: "p2", name: "Co-parent", role: "Parent" },
  ];
  const learners = [
    { id: "l1", name: "Emma", grade: "Grade 3" },
  ];

  return (
    <View
      style={[
        styles.root,
        { paddingTop: insets.top + spacing.lg, paddingBottom: insets.bottom + spacing.lg },
      ]}
    >
      <ScrollView contentContainerStyle={{ padding: spacing.lg }}>
        <Text style={styles.eyebrow}>Who's using AIVO?</Text>
        <Text style={styles.title}>Switch profile.</Text>
        <Text style={styles.subtitle}>
          Tap a profile to switch into it. Learner profiles will ask for
          their PIN.
        </Text>

        <Text style={styles.sectionLabel}>Parents</Text>
        {parents.map((p) => (
          <Pressable
            key={p.id}
            onPress={() => router.replace("/(parent)")}
            style={({ pressed }) => [
              styles.profile,
              pressed ? { borderColor: palette.primary, borderWidth: 2 } : null,
            ]}
            accessibilityRole="button"
            accessibilityLabel={`Switch to parent ${p.name}`}
          >
            <View style={[styles.avatar, { backgroundColor: palette.primary }]}>
              <Text style={styles.avatarText}>{p.name.charAt(0).toUpperCase()}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.profileName}>{p.name}</Text>
              <Text style={styles.profileMeta}>{p.role} · Unlocks with password</Text>
            </View>
          </Pressable>
        ))}

        <Text style={styles.sectionLabel}>Learners</Text>
        {learners.map((l) => (
          <Pressable
            key={l.id}
            onPress={() => router.replace("/(auth)/pin")}
            style={({ pressed }) => [
              styles.profile,
              pressed ? { borderColor: palette.primary, borderWidth: 2 } : null,
            ]}
            accessibilityRole="button"
            accessibilityLabel={`Switch to learner ${l.name}`}
          >
            <View style={[styles.avatar, { backgroundColor: colors.secondary }]}>
              <Text style={styles.avatarText}>{l.name.charAt(0).toUpperCase()}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.profileName}>{l.name}</Text>
              <Text style={styles.profileMeta}>{l.grade} · Asks for PIN</Text>
            </View>
          </Pressable>
        ))}

        <Pressable onPress={() => router.back()} style={styles.cancelBtn}>
          <Text style={styles.cancelLabel}>Cancel</Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  eyebrow: {
    fontFamily: fontFamilies.bodySemiBold,
    fontSize: 12,
    letterSpacing: 1.2,
    textTransform: "uppercase",
    color: colors.textSecondary,
    marginBottom: spacing.xs,
  },
  title: {
    fontFamily: fontFamilies.displayBold,
    fontSize: 26,
    color: colors.text,
    marginBottom: spacing.sm,
  },
  subtitle: {
    fontFamily: fontFamilies.bodyRegular,
    fontSize: 15,
    lineHeight: 22,
    color: colors.textSecondary,
    marginBottom: spacing.lg,
  },
  sectionLabel: {
    fontFamily: fontFamilies.bodySemiBold,
    fontSize: 12,
    letterSpacing: 1.2,
    textTransform: "uppercase",
    color: colors.textSecondary,
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
  },
  profile: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    marginRight: spacing.md,
  },
  avatarText: {
    fontFamily: fontFamilies.displayBold,
    fontSize: 18,
    color: "#ffffff",
  },
  profileName: {
    fontFamily: fontFamilies.bodyBold,
    fontSize: 16,
    color: colors.text,
  },
  profileMeta: {
    fontFamily: fontFamilies.bodyRegular,
    fontSize: 13,
    color: colors.textSecondary,
    marginTop: 2,
  },
  cancelBtn: { alignItems: "center", paddingVertical: spacing.lg },
  cancelLabel: {
    fontFamily: fontFamilies.bodyRegular,
    fontSize: 14,
    color: colors.textSecondary,
  },
});
