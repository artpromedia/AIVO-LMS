import React, { useEffect, useState } from "react";
import { View, Text, Pressable, StyleSheet, ActivityIndicator } from "react-native";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "@/hooks/useTranslation";
import { useAuth } from "@/hooks/useAuth";
import { useLearners } from "@/hooks/useLearners";
import { getRememberedFamily, type RememberedLearner } from "@/lib/rememberedFamily";
import { spacing, radius } from "@/constants/colors";
import { fontFamilies } from "@/constants/typography";
import { useSensoryPalette } from "@/context/SensoryModeProvider";
import { ResponsiveScreen } from "@/src/components/layout/ResponsiveScreen";

/**
 * /(auth)/learner-login
 *
 * The learner app's own login surface. Instead of the parent having to
 * retype their email, this screen shows the learner profiles on the
 * account as big, tappable cards — tap a face, enter the PIN, and land
 * straight in the learning interface.
 *
 * Two roster sources, in priority order:
 *   1. A live parent session (`useAuth()` + `useLearners()`), e.g. a
 *      parent tapping "Login as learner" from their dashboard.
 *   2. The device-local snapshot (`getRememberedFamily()`) written the
 *      last time a parent was signed in — this is what powers the
 *      cold-start path where no one is authenticated yet.
 *
 * Tapping a learner routes to /(auth)/pin?parentId=…&learnerId=… so the
 * PIN pad (the actual learner authentication) is pre-addressed. When no
 * roster is available we fall back to the manual parent-email + PIN flow.
 */
export default function LearnerLoginScreen() {
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();
  const palette = useSensoryPalette();
  const { user, isAuthenticated } = useAuth();
  const isParent = isAuthenticated && user?.role === "PARENT";

  // Live roster — only meaningful when a parent is actually signed in.
  const learnersQuery = useLearners();

  // Cached roster for the cold-start (unauthenticated) path.
  const [remembered, setRemembered] = useState<{
    parentId: string;
    learners: RememberedLearner[];
  } | null>(null);
  const [rememberedLoaded, setRememberedLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const fam = await getRememberedFamily();
      if (cancelled) return;
      setRemembered(fam ? { parentId: fam.parentId, learners: fam.learners } : null);
      setRememberedLoaded(true);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Resolve the active roster + the parentId the PIN check authenticates
  // against. A live parent session always wins over the cached snapshot.
  const liveLearners = isParent ? learnersQuery.data : undefined;
  const parentId = isParent ? user?.id : remembered?.parentId;
  const profiles: RememberedLearner[] = (liveLearners ?? remembered?.learners ?? []).map((l) => ({
    id: l.id,
    firstName: l.firstName,
    lastName: l.lastName,
    gradeLevel: l.gradeLevel,
    avatar: (l as { avatar?: string }).avatar,
  }));

  const loading = isParent ? learnersQuery.isLoading : !rememberedLoaded;

  const openLearner = (learnerId: string) => {
    if (!parentId) return;
    router.push({
      pathname: "/(auth)/pin",
      params: { parentId, learnerId },
    });
  };

  return (
    <ResponsiveScreen
      maxWidth="auth"
      background={palette.bgPage}
      contentContainerStyle={{ paddingTop: insets.top + spacing.lg, paddingBottom: spacing.xl }}
    >
      <View style={styles.topRow}>
        <Pressable
          onPress={() => router.back()}
          hitSlop={12}
          accessibilityRole="button"
          accessibilityLabel={t("common.back", "Back")}
          style={[
            styles.backBtn,
            { backgroundColor: palette.bgRaised, borderColor: palette.border },
          ]}
        >
          <Ionicons name="chevron-back" size={22} color={palette.ink} />
        </Pressable>
      </View>

      <View style={styles.header}>
        <View style={[styles.headerBadge, { backgroundColor: palette.accentSoft }]}>
          <Text style={styles.headerEmoji}>🎓</Text>
        </View>
        <Text style={[styles.title, { color: palette.ink }]}>
          {t("auth.whoIsLearning", "Who's learning today?")}
        </Text>
        <Text style={[styles.subtitle, { color: palette.inkMuted }]}>
          {t("auth.tapYourProfile", "Tap your profile, then enter your PIN.")}
        </Text>
      </View>

      {loading ? (
        <View style={styles.loadingRow}>
          <ActivityIndicator color={palette.primary} />
          <Text style={[styles.loadingText, { color: palette.inkMuted }]}>
            {t("auth.loadingProfiles", "Loading profiles…")}
          </Text>
        </View>
      ) : profiles.length > 0 && parentId ? (
        <View style={styles.grid}>
          {profiles.map((l) => {
            const name =
              `${l.firstName ?? ""} ${l.lastName ?? ""}`.trim() || t("auth.learner", "Learner");
            const initial = (l.firstName?.trim().charAt(0) || "?").toUpperCase();
            return (
              <Pressable
                key={l.id}
                onPress={() => openLearner(l.id)}
                accessibilityRole="button"
                accessibilityLabel={t("auth.continueAsLearner", {
                  name,
                  defaultValue: `Continue as ${name}`,
                })}
                style={({ pressed }) => [
                  styles.profileCard,
                  {
                    backgroundColor: palette.bgRaised,
                    borderColor: pressed ? palette.primary : palette.border,
                    borderWidth: pressed ? 2 : 1,
                  },
                ]}
              >
                <View style={[styles.avatar, { backgroundColor: palette.accentSoft }]}>
                  <Text style={[styles.avatarText, { color: palette.accent }]}>{initial}</Text>
                </View>
                <Text style={[styles.profileName, { color: palette.ink }]} numberOfLines={1}>
                  {name}
                </Text>
                {l.gradeLevel ? (
                  <Text style={[styles.profileMeta, { color: palette.inkMuted }]} numberOfLines={1}>
                    {t("common.grade", {
                      grade: l.gradeLevel,
                      defaultValue: `Grade ${l.gradeLevel}`,
                    })}
                  </Text>
                ) : null}
              </Pressable>
            );
          })}
        </View>
      ) : (
        <View
          style={[
            styles.emptyCard,
            { backgroundColor: palette.bgRaised, borderColor: palette.border },
          ]}
        >
          <Ionicons name="people-outline" size={40} color={palette.inkMuted} />
          <Text style={[styles.emptyText, { color: palette.inkMuted }]}>
            {t(
              "auth.noProfilesYet",
              "No learner profiles on this device yet. Enter your parent's email to continue.",
            )}
          </Text>
          <Pressable
            onPress={() => router.push("/(auth)/pin")}
            accessibilityRole="button"
            style={[styles.primaryBtn, { backgroundColor: palette.primary }]}
          >
            <Text style={[styles.primaryBtnText, { color: palette.primaryFg }]}>
              {t("auth.enterParentEmailCta", "Use parent's email")}
            </Text>
          </Pressable>
        </View>
      )}

      <Pressable
        onPress={() => router.replace("/(auth)/login")}
        accessibilityRole="button"
        style={styles.parentLink}
      >
        <Text style={[styles.parentLinkText, { color: palette.primary }]}>
          {t("auth.signInAsParent", "Sign in as a parent instead")}
        </Text>
      </Pressable>
    </ResponsiveScreen>
  );
}

const styles = StyleSheet.create({
  topRow: { flexDirection: "row", alignItems: "center", marginBottom: spacing.md },
  backBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  header: { alignItems: "center", marginBottom: spacing.lg },
  headerBadge: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.md,
  },
  headerEmoji: { fontSize: 34 },
  title: {
    fontFamily: fontFamilies.displayBold,
    fontSize: 24,
    textAlign: "center",
  },
  subtitle: {
    fontFamily: fontFamilies.bodyRegular,
    fontSize: 14,
    textAlign: "center",
    marginTop: 6,
  },
  loadingRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
    paddingVertical: spacing.xl,
  },
  loadingText: { fontFamily: fontFamilies.bodyRegular, fontSize: 14 },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    gap: spacing.md,
  },
  profileCard: {
    width: 150,
    borderRadius: radius.xxl,
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.md,
    alignItems: "center",
  },
  avatar: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.sm,
  },
  avatarText: { fontFamily: fontFamilies.displayBold, fontSize: 30 },
  profileName: { fontFamily: fontFamilies.bodyBold, fontSize: 16, textAlign: "center" },
  profileMeta: { fontFamily: fontFamilies.bodyRegular, fontSize: 13, marginTop: 2 },
  emptyCard: {
    borderRadius: radius.xxl,
    borderWidth: 1,
    padding: spacing.lg,
    alignItems: "center",
    gap: spacing.md,
  },
  emptyText: {
    fontFamily: fontFamilies.bodyRegular,
    fontSize: 14,
    textAlign: "center",
    lineHeight: 20,
  },
  primaryBtn: {
    height: 50,
    borderRadius: 9999,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing.xl,
  },
  primaryBtnText: { fontFamily: fontFamilies.bodyBold, fontSize: 15 },
  parentLink: { alignItems: "center", paddingVertical: spacing.lg, marginTop: spacing.md },
  parentLinkText: { fontFamily: fontFamilies.bodyBold, fontSize: 15 },
});
