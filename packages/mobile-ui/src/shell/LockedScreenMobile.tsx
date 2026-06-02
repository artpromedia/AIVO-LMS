import React from "react";
import { View, Text, Pressable, StyleSheet, ScrollView } from "react-native";
import { NAV_AREA_META, ROLE_META, getPermission, type NavArea, type Role } from "@aivo/nav";
import { theme } from "../theme";

/**
 * Full-screen mobile "locked" state. Mirrors the web LockedScreen
 * but uses RN primitives and follows the calm/glass look at mobile
 * scale: hero icon slot, area title, role-specific reason copy from
 * the @aivo/nav matrix, optional CTA.
 *
 * Hosts pass a `renderIcon` so the package stays icon-library-free.
 */
export interface LockedScreenMobileProps {
  role: Role;
  area: NavArea;
  renderIcon?: (area: NavArea) => React.ReactNode;
  onCta?: () => void;
}

export function LockedScreenMobile({ role, area, renderIcon, onCta }: LockedScreenMobileProps) {
  const areaMeta = NAV_AREA_META[area];
  const roleMeta = ROLE_META[role];
  const permission = getPermission(role, area);

  const reason =
    permission.lockReason ??
    `As a ${roleMeta.label.toLowerCase()}, ${areaMeta.label} isn't part of your day-to-day in AIVO.`;
  const cta = permission.lockCta;

  return (
    <ScrollView
      style={styles.root}
      contentContainerStyle={styles.content}
      accessibilityRole="summary"
    >
      <View style={styles.iconWrap}>
        <View style={styles.iconBadge}>
          {renderIcon ? renderIcon(area) : <Text style={styles.iconGlyph}>🔒</Text>}
        </View>
        <View style={styles.lockOverlay}>
          <Text style={styles.lockGlyph}>🔒</Text>
        </View>
      </View>
      <Text style={styles.title}>{areaMeta.label}</Text>
      <Text style={styles.reason}>{reason}</Text>
      <Text style={styles.roleNote}>You're signed in as {roleMeta.label.toLowerCase()}.</Text>
      {cta && onCta && (
        <Pressable
          onPress={onCta}
          accessibilityRole="button"
          accessibilityLabel={cta.label}
          style={({ pressed }) => [styles.cta, pressed && styles.ctaPressed]}
        >
          <Text style={styles.ctaText}>{cta.label}</Text>
        </Pressable>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  content: {
    flexGrow: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: theme.spacing.xl,
  },
  iconWrap: {
    width: 96,
    height: 96,
    marginBottom: theme.spacing.lg,
  },
  iconBadge: {
    width: 96,
    height: 96,
    borderRadius: theme.radius.xxl,
    backgroundColor: theme.colors.primaryLight,
    alignItems: "center",
    justifyContent: "center",
  },
  lockOverlay: {
    position: "absolute",
    right: -4,
    bottom: -4,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: theme.colors.surface,
    alignItems: "center",
    justifyContent: "center",
    ...theme.shadows.sm,
  },
  iconGlyph: {
    fontSize: 36,
  },
  lockGlyph: {
    fontSize: 18,
  },
  title: {
    fontSize: 24,
    fontFamily: theme.fonts.heading,
    color: theme.colors.text,
    textAlign: "center",
    marginBottom: theme.spacing.sm,
  },
  reason: {
    fontSize: 15,
    color: theme.colors.textSecondary,
    textAlign: "center",
    lineHeight: 22,
    maxWidth: 360,
  },
  roleNote: {
    fontSize: 13,
    color: theme.colors.textSecondary,
    marginTop: theme.spacing.md,
  },
  cta: {
    marginTop: theme.spacing.xl,
    backgroundColor: theme.colors.primary,
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.md,
    borderRadius: theme.radius.xl,
    ...theme.shadows.md,
  },
  ctaPressed: {
    opacity: 0.85,
  },
  ctaText: {
    color: "#fff",
    fontFamily: theme.fonts.bodyBold,
    fontSize: 15,
  },
});
