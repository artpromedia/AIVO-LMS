import React from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSensoryPalette } from "@/context/SensoryModeProvider";
import { ResponsiveScreen } from "@/src/components/layout/ResponsiveScreen";
import { AivoLogo } from "@/components/AivoLogo";
import { SensoryToggle } from "@/components/ui";
import { spacing } from "@/constants/colors";
import { fontFamilies } from "@/constants/typography";

/**
 * Shared scaffold for the onboarding flow — the mobile analogue of
 * web's `AuthShell` + `AuthCard`. Brand header (logo + sensory toggle),
 * an optional back button, eyebrow/title/subtitle, body, and a sticky
 * footer for actions. Capped to the `auth` content width so it reads
 * well on tablets.
 */
export interface OnboardingScaffoldProps {
  eyebrow?: string;
  title: string;
  subtitle?: string;
  children?: React.ReactNode;
  /** Pinned action area (buttons / links). */
  footer?: React.ReactNode;
  onBack?: () => void;
}

export function OnboardingScaffold({
  eyebrow,
  title,
  subtitle,
  children,
  footer,
  onBack,
}: OnboardingScaffoldProps) {
  const palette = useSensoryPalette();
  return (
    <View style={{ flex: 1, backgroundColor: palette.bgPage }}>
      <ResponsiveScreen maxWidth="auth" background={palette.bgPage}>
        <View style={styles.topBar}>
          {onBack ? (
            <Pressable
              onPress={onBack}
              accessibilityRole="button"
              accessibilityLabel="Back"
              hitSlop={8}
              style={[
                styles.backBtn,
                { backgroundColor: palette.bgRaised, borderColor: palette.border },
              ]}
            >
              <Ionicons name="chevron-back" size={22} color={palette.ink} />
            </Pressable>
          ) : (
            <AivoLogo width={96} />
          )}
          <SensoryToggle variant="icon" />
        </View>

        {eyebrow ? (
          <Text style={[styles.eyebrow, { color: palette.primary }]}>{eyebrow}</Text>
        ) : null}
        <Text style={[styles.title, { color: palette.ink }]}>{title}</Text>
        {subtitle ? (
          <Text style={[styles.subtitle, { color: palette.inkMuted }]}>{subtitle}</Text>
        ) : null}

        <View style={styles.body}>{children}</View>
      </ResponsiveScreen>
      {footer ? (
        <View
          style={[
            styles.footer,
            { backgroundColor: palette.bgRaised, borderTopColor: palette.border },
          ]}
        >
          {footer}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: spacing.lg,
  },
  backBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  eyebrow: {
    fontSize: 12,
    fontFamily: fontFamilies.bodyBold,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  title: { fontSize: 28, fontFamily: fontFamilies.displayBold, lineHeight: 34 },
  subtitle: { fontSize: 15, fontFamily: fontFamilies.bodyRegular, marginTop: 8, lineHeight: 22 },
  body: { marginTop: spacing.lg, gap: spacing.md },
  footer: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.xl,
    borderTopWidth: 1,
    gap: spacing.sm,
  },
});
