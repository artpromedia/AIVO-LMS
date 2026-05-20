import React, { useState } from "react";
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  Switch,
  Platform,
} from "react-native";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors, spacing, radius } from "@/constants/colors";
import { fontFamilies } from "@/constants/typography";
import { useSensoryPalette } from "@/context/SensoryModeProvider";

/**
 * /(auth)/biometric-setup
 *
 * Offers Face ID / Touch ID (iOS) or fingerprint (Android) as an
 * accelerator on top of the PIN. The PIN remains the source of
 * truth; biometrics are an unlock convenience only.
 *
 * `expo-local-authentication` is not currently a dependency of this
 * app, so this screen captures intent only and stores a preference.
 * The actual biometric prompt will be wired up when the dep is
 * added — at which point only the `useBiometric` handler below
 * needs to change.
 */
export default function BiometricSetupScreen() {
  const insets = useSafeAreaInsets();
  const palette = useSensoryPalette();
  const [enabled, setEnabled] = useState(false);

  const biometryLabel =
    Platform.OS === "ios" ? "Face ID / Touch ID" : "Fingerprint";

  return (
    <View
      style={[
        styles.root,
        { paddingTop: insets.top + spacing.lg, paddingBottom: insets.bottom + spacing.lg },
      ]}
    >
      <View style={styles.body}>
        <Text style={styles.eyebrow}>One-tap unlock</Text>
        <Text style={styles.title}>Use {biometryLabel} to unlock?</Text>
        <Text style={styles.subtitle}>
          Adds a faster way to switch into your parent session. Your PIN
          still works, and any sensitive action still re-prompts.
        </Text>

        <View style={styles.row}>
          <View style={{ flex: 1, paddingRight: spacing.md }}>
            <Text style={styles.rowTitle}>Enable {biometryLabel}</Text>
            <Text style={styles.rowBody}>
              Stored locally on this device. We never see your biometric data.
            </Text>
          </View>
          <Switch
            value={enabled}
            onValueChange={setEnabled}
            trackColor={{ true: palette.primary, false: colors.border }}
          />
        </View>

        <View style={styles.reassure}>
          <Text style={styles.reassureTitle}>It's a shortcut, not a vault.</Text>
          <Text style={styles.reassureBody}>
            Approving a child profile, changing consent, or accessing billing
            still requires your PIN or password.
          </Text>
        </View>
      </View>

      <View style={styles.footer}>
        <Pressable
          onPress={() => router.replace("/(auth)/session-switch")}
          style={[styles.cta, { backgroundColor: palette.primary }]}
          accessibilityRole="button"
          accessibilityLabel={enabled ? `Enable ${biometryLabel} and continue` : "Skip and continue"}
        >
          <Text style={styles.ctaLabel}>
            {enabled ? `Enable ${biometryLabel}` : "Skip for now"}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.background,
    paddingHorizontal: spacing.lg,
  },
  body: { flex: 1 },
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
  },
  rowTitle: {
    fontFamily: fontFamilies.bodyBold,
    fontSize: 15,
    color: colors.text,
    marginBottom: spacing.xs,
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
    marginTop: spacing.lg,
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
  footer: {},
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
});
