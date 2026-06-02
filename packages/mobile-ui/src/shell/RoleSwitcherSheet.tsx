import React from "react";
import { Modal, View, Text, Pressable, StyleSheet, ScrollView } from "react-native";
import { ROLES, ROLE_META, type Role } from "@aivo/nav";
import { theme } from "../theme";
import type { MobileRoleOption } from "./types";

/**
 * Bottom-sheet role switcher for mobile.
 *
 * Roles flagged `requiresStepUp: true` (parent / teacher / admins /
 * internal) show a shield badge and call `onStepUp` instead of
 * `onSelect` so the host can prompt for biometric or PIN unlock
 * before completing the swap. Learner is the only role that swaps
 * without step-up — this is intentional so a child handing the
 * tablet back to a guardian still requires verification.
 *
 * The sheet itself stays presentation-only: no auth state lives
 * here. It also avoids any animation library so it works in plain
 * React Native + Expo without extra peer deps.
 */
export interface RoleSwitcherSheetProps {
  visible: boolean;
  currentRole: Role;
  options: MobileRoleOption[];
  onClose: () => void;
  onSelect: (role: Role) => void;
  /** Called when the chosen role requires biometric/PIN step-up. */
  onStepUp?: (role: Role) => void;
}

export function RoleSwitcherSheet({
  visible,
  currentRole,
  options,
  onClose,
  onSelect,
  onStepUp,
}: RoleSwitcherSheetProps) {
  // Filter to roles available on mobile (district/internal hide).
  const mobileOptions = options.filter((o) => ROLE_META[o.id].onMobile);

  const handlePick = (role: Role) => {
    const meta = ROLE_META[role];
    if (meta.requiresStepUp && role !== currentRole && onStepUp) {
      onStepUp(role);
    } else {
      onSelect(role);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} accessibilityLabel="Close" />
      <View style={styles.sheet} accessibilityViewIsModal>
        <View style={styles.grabber} />
        <Text style={styles.title}>Switch role</Text>
        <Text style={styles.subtitle}>
          Roles marked with a shield need a quick PIN or biometric check.
        </Text>
        <ScrollView style={styles.list} contentContainerStyle={{ paddingBottom: 24 }}>
          {ROLES.filter((r) => mobileOptions.some((o) => o.id === r)).map((role) => {
            const opt = mobileOptions.find((o) => o.id === role)!;
            const meta = ROLE_META[role];
            const isCurrent = role === currentRole;
            const disabled = !opt.available && !isCurrent;
            return (
              <Pressable
                key={role}
                disabled={disabled}
                onPress={() => handlePick(role)}
                accessibilityRole="button"
                accessibilityState={{ selected: isCurrent, disabled }}
                style={({ pressed }) => [
                  styles.row,
                  isCurrent && styles.rowCurrent,
                  pressed && !disabled && styles.rowPressed,
                  disabled && styles.rowDisabled,
                ]}
              >
                <View style={styles.avatar}>
                  <Text style={styles.avatarText}>{meta.label.slice(0, 1)}</Text>
                </View>
                <View style={styles.rowBody}>
                  <View style={styles.rowHeader}>
                    <Text style={styles.rowLabel}>{meta.label}</Text>
                    {meta.requiresStepUp && (
                      <View style={styles.shield}>
                        <Text style={styles.shieldText}>SECURE</Text>
                      </View>
                    )}
                  </View>
                  <Text style={styles.rowDescription} numberOfLines={2}>
                    {meta.description}
                  </Text>
                </View>
                {isCurrent && <Text style={styles.check}>✓</Text>}
              </Pressable>
            );
          })}
        </ScrollView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(15, 23, 42, 0.4)",
  },
  sheet: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: theme.colors.surface,
    borderTopLeftRadius: theme.radius.xxl,
    borderTopRightRadius: theme.radius.xxl,
    paddingTop: 12,
    paddingHorizontal: theme.spacing.lg,
    paddingBottom: 8,
    maxHeight: "85%",
    ...theme.shadows.lg,
  },
  grabber: {
    alignSelf: "center",
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: theme.colors.border,
    marginBottom: 12,
  },
  title: {
    fontSize: 20,
    fontFamily: theme.fonts.heading,
    color: theme.colors.text,
  },
  subtitle: {
    fontSize: 13,
    color: theme.colors.textSecondary,
    marginTop: 4,
    marginBottom: 12,
  },
  list: {
    flexGrow: 0,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: theme.radius.lg,
    gap: 12,
  },
  rowCurrent: {
    backgroundColor: theme.colors.primaryLight,
  },
  rowPressed: {
    opacity: 0.7,
  },
  rowDisabled: {
    opacity: 0.5,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: theme.colors.secondary,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: {
    color: "#fff",
    fontFamily: theme.fonts.bodyBold,
    fontSize: 16,
  },
  rowBody: {
    flex: 1,
  },
  rowHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  rowLabel: {
    fontSize: 15,
    fontFamily: theme.fonts.bodyBold,
    color: theme.colors.text,
  },
  shield: {
    backgroundColor: theme.colors.info,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: theme.radius.sm,
  },
  shieldText: {
    color: "#fff",
    fontSize: 9,
    fontFamily: theme.fonts.bodyBold,
    letterSpacing: 0.5,
  },
  rowDescription: {
    fontSize: 12,
    color: theme.colors.textSecondary,
    marginTop: 2,
  },
  check: {
    fontSize: 18,
    color: theme.colors.primaryDark,
    fontFamily: theme.fonts.bodyBold,
  },
});
