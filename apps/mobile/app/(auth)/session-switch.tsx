import React from "react";
import { View, Text, Pressable, StyleSheet, ScrollView, ActivityIndicator } from "react-native";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors, spacing, radius } from "@/constants/colors";
import { fontFamilies } from "@/constants/typography";
import { useSensoryPalette } from "@/context/SensoryModeProvider";
import { useAuth } from "@/hooks/useAuth";
import { useLearners } from "@/hooks/useLearners";

/**
 * /(auth)/session-switch
 *
 * Clean parent <-> learner session switcher backed by real
 * identity-svc data:
 *
 *   - The signed-in parent is read straight off `useAuth()`, which is
 *     fed by the JWT issued by identity-svc /api/auth/login.
 *   - The learner roster comes from `useLearners()` →
 *     `GET /api/users/learners`, returning the parent's own learners.
 *   - Tapping the parent row stays in /(parent) — the JWT already
 *     represents them, no extra hop needed.
 *   - Tapping a learner routes to /(auth)/pin?parentId=…&learnerId=…
 *     so PinScreen can pre-fill the parent identifier (the PIN check
 *     itself is what authenticates the learner against parentId).
 *   - "Sign in as a different parent" is a real session swap: it
 *     calls `logout()` (which hits identity-svc /api/auth/logout and
 *     clears tokens + biometric opt-in) before bouncing to /login.
 *
 * The screen lives in the auth stack because switching profiles is an
 * auth-equivalent action — the device's effective identity changes.
 */
type SwitchTarget = "stay" | "learner" | "new_parent" | "cancel";

export default function SessionSwitchScreen() {
  const insets = useSafeAreaInsets();
  const palette = useSensoryPalette();
  const { user, logout, isAuthenticated } = useAuth();
  const learnersQuery = useLearners();

  const learners = learnersQuery.data ?? [];
  const learnersErrored = learnersQuery.isError;
  const learnersLoading = learnersQuery.isLoading;

  const handleTap = async (target: SwitchTarget, learnerId?: string) => {
    if (target === "stay") {
      router.replace("/(parent)");
      return;
    }
    if (target === "learner" && learnerId && user?.id) {
      router.replace({
        pathname: "/(auth)/pin",
        params: { parentId: user.id, learnerId },
      });
      return;
    }
    if (target === "new_parent") {
      await logout();
      router.replace("/(auth)/login");
      return;
    }
    if (target === "cancel") {
      router.back();
    }
  };

  // If the user got here unauthenticated (deep link, expired session),
  // there's nothing to switch *between* — bounce them to login.
  if (!isAuthenticated || !user) {
    router.replace("/(auth)/login");
    return null;
  }

  const initial = (
    user.name?.trim().charAt(0) ||
    user.email?.trim().charAt(0) ||
    "?"
  ).toUpperCase();

  return (
    <View
      style={[
        styles.root,
        { paddingTop: insets.top + spacing.lg, paddingBottom: insets.bottom + spacing.lg },
      ]}
    >
      <ScrollView contentContainerStyle={{ padding: spacing.lg }}>
        <Text style={styles.eyebrow}>Who&apos;s using AIVO?</Text>
        <Text style={styles.title}>Switch profile.</Text>
        <Text style={styles.subtitle}>
          Tap a profile to switch into it. Learner profiles will ask for their PIN.
        </Text>

        <Text style={styles.sectionLabel}>Signed in</Text>
        <Pressable
          onPress={() => handleTap("stay")}
          style={({ pressed }) => [
            styles.profile,
            pressed ? { borderColor: palette.primary, borderWidth: 2 } : null,
          ]}
          accessibilityRole="button"
          accessibilityLabel={`Continue as ${user.name || user.email || "current account"}`}
        >
          <View style={[styles.avatar, { backgroundColor: palette.primary }]}>
            <Text style={styles.avatarText}>{initial}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.profileName}>{user.name || user.email || "You"}</Text>
            <Text style={styles.profileMeta}>
              {humanizeRole(user.role)}
              {user.email ? ` · ${user.email}` : ""}
            </Text>
          </View>
        </Pressable>

        <Text style={styles.sectionLabel}>Learners</Text>
        {learnersLoading ? (
          <View style={styles.loadingRow}>
            <ActivityIndicator color={palette.primary} />
            <Text style={styles.loadingText}>Loading learners…</Text>
          </View>
        ) : learnersErrored ? (
          <Text style={styles.errorText}>
            Couldn&apos;t load your learners. Pull down to retry from the parent dashboard.
          </Text>
        ) : learners.length === 0 ? (
          <Text style={styles.emptyText}>No learners yet. Add one from the parent dashboard.</Text>
        ) : (
          learners.map((l) => {
            const displayName = `${l.firstName ?? ""} ${l.lastName ?? ""}`.trim() || "Learner";
            const meta = l.gradeLevel ? `${l.gradeLevel} · Asks for PIN` : "Asks for PIN";
            const learnerInitial = (l.firstName?.trim().charAt(0) || "?").toUpperCase();
            return (
              <Pressable
                key={l.id}
                onPress={() => handleTap("learner", l.id)}
                style={({ pressed }) => [
                  styles.profile,
                  pressed ? { borderColor: palette.primary, borderWidth: 2 } : null,
                ]}
                accessibilityRole="button"
                accessibilityLabel={`Switch to learner ${displayName}`}
              >
                <View style={[styles.avatar, { backgroundColor: colors.secondary }]}>
                  <Text style={styles.avatarText}>{learnerInitial}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.profileName}>{displayName}</Text>
                  <Text style={styles.profileMeta}>{meta}</Text>
                </View>
              </Pressable>
            );
          })
        )}

        <Pressable
          onPress={() => handleTap("new_parent")}
          style={styles.secondaryAction}
          accessibilityRole="button"
          accessibilityLabel="Sign in as a different parent"
        >
          <Text style={[styles.secondaryLabel, { color: palette.primary }]}>
            Sign in as a different account
          </Text>
        </Pressable>

        <Pressable onPress={() => handleTap("cancel")} style={styles.cancelBtn}>
          <Text style={styles.cancelLabel}>Cancel</Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}

function humanizeRole(role: string | undefined): string {
  switch (role) {
    case "PARENT":
      return "Parent";
    case "LEARNER":
      return "Learner";
    case "TEACHER":
      return "Teacher";
    case "CAREGIVER":
      return "Caregiver";
    case "THERAPIST":
      return "Therapist";
    case "SCHOOL_ADMIN":
      return "School admin";
    case "DISTRICT_ADMIN":
      return "District admin";
    case "PLATFORM_ADMIN":
      return "Platform admin";
    default:
      return role || "Account";
  }
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
  loadingRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.sm,
  },
  loadingText: {
    fontFamily: fontFamilies.bodyRegular,
    fontSize: 13,
    color: colors.textSecondary,
    marginLeft: spacing.sm,
  },
  errorText: {
    fontFamily: fontFamilies.bodyRegular,
    fontSize: 13,
    color: "#b91c1c",
    paddingVertical: spacing.sm,
  },
  emptyText: {
    fontFamily: fontFamilies.bodyRegular,
    fontSize: 13,
    color: colors.textSecondary,
    paddingVertical: spacing.sm,
  },
  secondaryAction: {
    alignItems: "center",
    paddingVertical: spacing.md,
    marginTop: spacing.lg,
  },
  secondaryLabel: {
    fontFamily: fontFamilies.bodyBold,
    fontSize: 15,
  },
  cancelBtn: { alignItems: "center", paddingVertical: spacing.lg },
  cancelLabel: {
    fontFamily: fontFamilies.bodyRegular,
    fontSize: 14,
    color: colors.textSecondary,
  },
});
