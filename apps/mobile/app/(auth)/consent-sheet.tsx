import React, { useState } from "react";
import { View, Text, Pressable, ScrollView, StyleSheet, Switch } from "react-native";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors, spacing, radius } from "@/constants/colors";
import { fontFamilies } from "@/constants/typography";
import { useSensoryPalette } from "@/context/SensoryModeProvider";

/**
 * /(auth)/consent-sheet
 *
 * Mobile counterpart to `apps/web-v2/app/onboarding/consent`. Presents
 * as a bottom sheet (registered with `presentation: "modal"` in the
 * (auth) layout) so it slides up over whatever scheduled it.
 *
 * Sprint-3 verbatim acceptance criteria enforced here:
 *   "Separate parent / school / AI consent."
 *   "No ambiguous consent language."
 *
 * Each row is its own toggle. Parent consent is required and cannot
 * be turned off — the row is disabled but visible so the user can
 * still read what they're agreeing to.
 */
export default function ConsentSheetScreen() {
  const insets = useSafeAreaInsets();
  const palette = useSensoryPalette();
  const [schoolShare, setSchoolShare] = useState(false);
  const [aiPersonalize, setAiPersonalize] = useState(false);
  const [marketing, setMarketing] = useState(false);

  return (
    <View style={[styles.root, { paddingTop: insets.top + spacing.lg }]}>
      <View style={styles.grabber} />
      <ScrollView
        contentContainerStyle={{
          padding: spacing.lg,
          paddingBottom: insets.bottom + spacing.xl * 2,
        }}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.eyebrow}>Your consent — your control</Text>
        <Text style={styles.title}>Choose what AIVO can do.</Text>
        <Text style={styles.subtitle}>
          Each row is a separate choice. Tap any row to read what it changes. You can change any of
          these later from Settings → Privacy.
        </Text>

        <Row
          title="Parent / guardian consent"
          description="I confirm I am the parent or legal guardian, and I agree to AIVO's Terms."
          badge="Required"
          value={true}
          onValueChange={() => {}}
          disabled
          accent={palette.primary}
        />
        <Row
          title="Share progress with my child's school"
          description="Lets teachers see mastery, lessons, and IEP supports. Independent from any AI choice."
          badge="Optional"
          value={schoolShare}
          onValueChange={setSchoolShare}
          accent={palette.primary}
        />
        <Row
          title="Use AI to personalize learning"
          description="AIVO adapts pacing and hints to your child. We never sell this data. Off keeps lessons non-personalized."
          badge="Optional"
          value={aiPersonalize}
          onValueChange={setAiPersonalize}
          accent={palette.primary}
        />
        <Row
          title="Send me product news"
          description="A short monthly email. Never sent to learners."
          badge="Optional"
          value={marketing}
          onValueChange={setMarketing}
          accent={palette.primary}
        />

        <View style={styles.reassure}>
          <Text style={styles.reassureTitle}>No bundles. No dark patterns.</Text>
          <Text style={styles.reassureBody}>
            School data sharing and AI personalization are independent. You can say yes to one and
            no to the other.
          </Text>
        </View>

        <Pressable
          onPress={() => router.replace("/(auth)/biometric-setup")}
          style={[styles.cta, { backgroundColor: palette.primary }]}
          accessibilityRole="button"
          accessibilityLabel="Save consent and continue"
        >
          <Text style={styles.ctaLabel}>Save and continue</Text>
        </Pressable>
        <Pressable onPress={() => router.back()} style={styles.cancelBtn}>
          <Text style={styles.cancelLabel}>Cancel</Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}

function Row({
  title,
  description,
  badge,
  value,
  onValueChange,
  disabled,
  accent,
}: {
  title: string;
  description: string;
  badge: string;
  value: boolean;
  onValueChange: (v: boolean) => void;
  disabled?: boolean;
  accent: string;
}) {
  return (
    <View
      style={[
        styles.row,
        value && !disabled ? { borderColor: accent, borderWidth: 2 } : null,
        disabled ? { opacity: 0.85 } : null,
      ]}
    >
      <View style={{ flex: 1, paddingRight: spacing.md }}>
        <View style={styles.rowHead}>
          <Text style={styles.rowTitle}>{title}</Text>
          <Text style={styles.rowBadge}>{badge}</Text>
        </View>
        <Text style={styles.rowBody}>{description}</Text>
      </View>
      <Switch
        value={value}
        onValueChange={onValueChange}
        disabled={disabled}
        trackColor={{ true: accent, false: colors.border }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  grabber: {
    alignSelf: "center",
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.border,
    marginBottom: spacing.sm,
  },
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
  row: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  rowHead: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: spacing.xs,
  },
  rowTitle: {
    fontFamily: fontFamilies.bodyBold,
    fontSize: 15,
    color: colors.text,
    flex: 1,
    marginRight: spacing.sm,
  },
  rowBadge: {
    fontFamily: fontFamilies.bodySemiBold,
    fontSize: 11,
    letterSpacing: 0.6,
    textTransform: "uppercase",
    color: colors.textSecondary,
  },
  rowBody: {
    fontFamily: fontFamilies.bodyRegular,
    fontSize: 13,
    lineHeight: 19,
    color: colors.textSecondary,
  },
  reassure: {
    backgroundColor: colors.primaryLight,
    borderRadius: radius.lg,
    padding: spacing.md,
    marginVertical: spacing.lg,
  },
  reassureTitle: {
    fontFamily: fontFamilies.bodyBold,
    fontSize: 14,
    color: colors.primaryDark,
    marginBottom: spacing.xs,
  },
  reassureBody: {
    fontFamily: fontFamilies.bodyRegular,
    fontSize: 13,
    lineHeight: 19,
    color: colors.primaryDark,
  },
  cta: {
    height: 52,
    borderRadius: radius.lg,
    alignItems: "center",
    justifyContent: "center",
  },
  ctaLabel: {
    fontFamily: fontFamilies.bodyBold,
    fontSize: 16,
    color: "#ffffff",
  },
  cancelBtn: { alignItems: "center", paddingVertical: spacing.md },
  cancelLabel: {
    fontFamily: fontFamilies.bodyRegular,
    fontSize: 14,
    color: colors.textSecondary,
  },
});
