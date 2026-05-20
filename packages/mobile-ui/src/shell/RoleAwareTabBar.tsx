import React from "react";
import { View, Text, Pressable, StyleSheet, type StyleProp, type ViewStyle } from "react-native";
import {
  NAV_AREA_META,
  getPrimaryAreas,
  type NavArea,
} from "@aivo/nav";
import { theme } from "../theme";
import type { NavIconRenderer, Role } from "./types";

/**
 * Role-aware bottom tab bar.
 *
 * Behaviour rules baked in:
 *
 *  - Learners get a maximum of 3 visible tabs + an optional "More"
 *    sheet trigger. Tabs are limited to *full* access areas so a
 *    learner never lands on a locked screen by accident.
 *  - Parent / teacher / school admin / district admin / internal
 *    get up to 5 tabs.
 *  - districtAdmin + internal are marked `onMobile: false` in the
 *    role registry — render an empty bar rather than crashing if a
 *    caller ever passes them through (defensive; Expo Router should
 *    keep them off mobile entirely).
 *
 * Visual contract: bottom tab bar, 64dp height, soft top border,
 * rounded corners on the top edge. Each tab is a 44dp touch target
 * with icon + 11dp label. Active tab fills the icon badge with
 * `primary` and shows the label in `primaryDark`.
 */
export interface RoleAwareTabBarProps {
  role: Role;
  activeArea?: NavArea;
  onSelect: (area: NavArea) => void;
  onMore?: () => void;
  renderIcon: NavIconRenderer;
  style?: StyleProp<ViewStyle>;
}

export function RoleAwareTabBar({
  role,
  activeArea,
  onSelect,
  onMore,
  renderIcon,
  style,
}: RoleAwareTabBarProps) {
  const allPrimary = getPrimaryAreas(role);
  const maxVisible = role === "learner" ? 3 : 5;
  const visible = allPrimary.slice(0, maxVisible);
  const hasOverflow = allPrimary.length > maxVisible && onMore !== undefined;

  return (
    <View style={[styles.bar, style]} accessibilityRole="tablist">
      {visible.map((area) => {
        const meta = NAV_AREA_META[area];
        const active = area === activeArea;
        return (
          <Pressable
            key={area}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            accessibilityLabel={meta.label}
            onPress={() => onSelect(area)}
            style={({ pressed }) => [styles.tab, pressed && styles.tabPressed]}
            hitSlop={8}
          >
            <View style={[styles.iconBadge, active && styles.iconBadgeActive]}>
              {renderIcon(area, active)}
            </View>
            <Text
              numberOfLines={1}
              style={[styles.label, active && styles.labelActive]}
            >
              {meta.label}
            </Text>
          </Pressable>
        );
      })}
      {hasOverflow && (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="More"
          onPress={onMore}
          style={({ pressed }) => [styles.tab, pressed && styles.tabPressed]}
          hitSlop={8}
        >
          <View style={styles.iconBadge}>
            <Text style={styles.moreGlyph}>•••</Text>
          </View>
          <Text style={styles.label}>More</Text>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: "row",
    backgroundColor: theme.colors.surface,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: theme.colors.border,
    paddingTop: 8,
    paddingBottom: 12,
    paddingHorizontal: 8,
    minHeight: 64,
    ...theme.shadows.sm,
  },
  tab: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 44,
    paddingVertical: 4,
  },
  tabPressed: {
    opacity: 0.7,
  },
  iconBadge: {
    width: 36,
    height: 28,
    borderRadius: theme.radius.lg,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "transparent",
  },
  iconBadgeActive: {
    backgroundColor: theme.colors.primaryLight,
  },
  label: {
    fontSize: 11,
    marginTop: 2,
    color: theme.colors.textSecondary,
    fontFamily: theme.fonts.bodyBold,
    maxWidth: 72,
    textAlign: "center",
  },
  labelActive: {
    color: theme.colors.primaryDark,
  },
  moreGlyph: {
    fontSize: 16,
    color: theme.colors.textSecondary,
    fontFamily: theme.fonts.bodyBold,
    letterSpacing: 1,
  },
});
