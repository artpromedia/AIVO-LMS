import React, { useEffect, useState } from "react";
import { View, Text, Pressable, StyleSheet, Switch, ActivityIndicator } from "react-native";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors, spacing, radius } from "@/constants/colors";
import { fontFamilies } from "@/constants/typography";
import { useSensoryPalette } from "@/context/SensoryModeProvider";
import {
  getBiometricSupport,
  isBiometricUnlockArmed,
  enableBiometricUnlock,
  disableBiometricUnlock,
  type BiometricSupport,
} from "@/lib/biometric";
import { getToken } from "@/lib/api";
import { useAuth } from "@/hooks/useAuth";

/**
 * /(auth)/biometric-setup
 *
 * Lets the signed-in user opt in or out of Face ID / Touch ID /
 * Fingerprint as a re-entry accelerator. The actual server session
 * still depends on the identity-svc JWT in SecureStore — biometrics
 * only gates the *read* of a copy of that token, so opting out simply
 * deletes the gated copy and leaves the rest of the auth state alone.
 *
 * Reachable from settings and from the post-signup onboarding flow.
 */
export default function BiometricSetupScreen() {
  const insets = useSafeAreaInsets();
  const palette = useSensoryPalette();
  const { user } = useAuth();

  const [support, setSupport] = useState<BiometricSupport | null>(null);
  const [enabled, setEnabled] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [s, armed] = await Promise.all([getBiometricSupport(), isBiometricUnlockArmed()]);
      if (cancelled) return;
      setSupport(s);
      setEnabled(armed.armed);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const biometryLabel = support?.label || "Biometric unlock";
  const unavailableReason =
    support && !support.available
      ? "This device doesn't support biometrics."
      : support && !support.enrolled
        ? `No ${biometryLabel.toLowerCase()} is set up in system settings.`
        : null;

  const handleToggle = async (next: boolean) => {
    setError(null);
    if (busy) return;
    setBusy(true);
    try {
      if (next) {
        const token = await getToken();
        if (!token) {
          setError("Sign in again to enable biometric unlock.");
          setBusy(false);
          return;
        }
        const result = await enableBiometricUnlock({
          accessToken: token,
          email: user?.email ?? "",
        });
        if (!result.enabled) {
          setError(
            result.reason === "cancelled"
              ? "Biometric prompt was cancelled."
              : result.reason === "not_enrolled"
                ? `Set up ${biometryLabel} in system settings first.`
                : result.reason === "no_hardware"
                  ? "This device doesn't support biometrics."
                  : "Could not enable biometric unlock.",
          );
          setEnabled(false);
        } else {
          setEnabled(true);
        }
      } else {
        await disableBiometricUnlock();
        setEnabled(false);
      }
    } finally {
      setBusy(false);
    }
  };

  const handleContinue = () => {
    router.replace("/(auth)/session-switch");
  };

  if (!support) {
    return (
      <View style={[styles.root, styles.center]}>
        <ActivityIndicator color={palette.primary} />
      </View>
    );
  }

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
          Adds a faster way back into your account. Your password still works, and any sensitive
          action still re-prompts.
        </Text>

        {unavailableReason ? (
          <View style={styles.warn}>
            <Text style={styles.warnText}>{unavailableReason}</Text>
          </View>
        ) : null}

        {error ? (
          <View style={styles.warn}>
            <Text style={styles.warnText}>{error}</Text>
          </View>
        ) : null}

        <View style={styles.row}>
          <View style={{ flex: 1, paddingRight: spacing.md }}>
            <Text style={styles.rowTitle}>Enable {biometryLabel}</Text>
            <Text style={styles.rowBody}>
              Stored locally on this device. We never see your biometric data.
            </Text>
          </View>
          <Switch
            value={enabled}
            onValueChange={handleToggle}
            disabled={busy || !support.available || !support.enrolled}
            trackColor={{ true: palette.primary, false: colors.border }}
          />
        </View>

        <View style={styles.reassure}>
          <Text style={styles.reassureTitle}>It&apos;s a shortcut, not a vault.</Text>
          <Text style={styles.reassureBody}>
            Approving a child profile, changing consent, or accessing billing still requires your
            password.
          </Text>
        </View>
      </View>

      <View style={styles.footer}>
        <Pressable
          onPress={handleContinue}
          style={[styles.cta, { backgroundColor: palette.primary }]}
          accessibilityRole="button"
          accessibilityLabel={
            enabled ? `Continue with ${biometryLabel} enabled` : "Skip and continue"
          }
        >
          <Text style={styles.ctaLabel}>{enabled ? "Continue" : "Skip for now"}</Text>
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
  center: { alignItems: "center", justifyContent: "center" },
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
  warn: {
    backgroundColor: "rgba(220, 38, 38, 0.08)",
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  warnText: {
    fontFamily: fontFamilies.bodyRegular,
    fontSize: 13,
    lineHeight: 19,
    color: "#b91c1c",
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
