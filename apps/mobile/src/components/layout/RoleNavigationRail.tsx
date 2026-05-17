import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useWindowSizeClass } from '../../design/useWindowSizeClass';
import { colors, spacing, radius } from '@/constants/colors';

export interface RailDestination {
  key: string;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  badge?: number;
  onPress: () => void;
  active?: boolean;
}

export interface RoleNavigationRailProps {
  destinations: RailDestination[];
  header?: React.ReactNode;
  footer?: React.ReactNode;
  activeTintColor?: string;
  inactiveTintColor?: string;
  background?: string;
  /**
   * 'rail' = compact 80dp rail with icon + label (medium tablets).
   * 'drawer' = 240dp persistent sidebar (expanded tablets).
   */
  variant?: 'auto' | 'rail' | 'drawer';
}

/**
 * Persistent left navigation for tablet shells. Replaces the bottom tab bar
 * on medium+ size classes so we don't waste tablet vertical space.
 */
export function RoleNavigationRail({
  destinations,
  header,
  footer,
  activeTintColor = colors.primary,
  inactiveTintColor = colors.textSecondary,
  background = colors.card,
  variant = 'auto',
}: RoleNavigationRailProps) {
  const insets = useSafeAreaInsets();
  const { sizeClass } = useWindowSizeClass();

  const resolved =
    variant === 'auto'
      ? sizeClass === 'expanded'
        ? 'drawer'
        : 'rail'
      : variant;
  const isDrawer = resolved === 'drawer';
  const width = isDrawer ? 240 : 84;

  return (
    <View
      style={[
        styles.container,
        {
          width,
          backgroundColor: background,
          paddingTop: insets.top + spacing.sm,
          paddingBottom: insets.bottom + spacing.sm,
        },
      ]}
    >
      {header ? <View style={styles.header}>{header}</View> : null}

      <View style={styles.items}>
        {destinations.map((dest) => {
          const tint = dest.active ? activeTintColor : inactiveTintColor;
          return (
            <Pressable
              key={dest.key}
              onPress={dest.onPress}
              accessibilityRole="button"
              accessibilityState={{ selected: !!dest.active }}
              accessibilityLabel={dest.label}
              style={({ pressed }) => [
                styles.item,
                isDrawer ? styles.itemDrawer : styles.itemRail,
                dest.active && { backgroundColor: activeTintColor + '14' },
                pressed && { opacity: 0.7 },
              ]}
            >
              <View>
                <Ionicons name={dest.icon} size={isDrawer ? 22 : 24} color={tint} />
                {dest.badge && dest.badge > 0 ? (
                  <View style={styles.badge}>
                    <Text style={styles.badgeText}>
                      {dest.badge > 9 ? '9+' : String(dest.badge)}
                    </Text>
                  </View>
                ) : null}
              </View>
              <Text
                numberOfLines={1}
                style={[
                  isDrawer ? styles.labelDrawer : styles.labelRail,
                  { color: tint },
                  dest.active && { fontFamily: 'Nunito-ExtraBold' },
                ]}
              >
                {dest.label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {footer ? <View style={styles.footer}>{footer}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRightWidth: StyleSheet.hairlineWidth,
    borderRightColor: colors.border,
    paddingHorizontal: spacing.sm,
  },
  header: { alignItems: 'center', marginBottom: spacing.md },
  items: { flex: 1, gap: spacing.xs },
  footer: { marginTop: spacing.sm },
  item: {
    borderRadius: radius.lg,
  },
  itemRail: {
    alignItems: 'center',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.xs,
    gap: 4,
  },
  itemDrawer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 12,
    gap: 12,
  },
  labelRail: {
    fontSize: 11,
    fontFamily: 'Nunito-SemiBold',
    textAlign: 'center',
  },
  labelDrawer: {
    fontSize: 14,
    fontFamily: 'Nunito-SemiBold',
    flex: 1,
  },
  badge: {
    position: 'absolute',
    top: -4,
    right: -8,
    minWidth: 16,
    height: 16,
    paddingHorizontal: 4,
    borderRadius: 8,
    backgroundColor: colors.error,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: {
    color: '#FFF',
    fontSize: 10,
    fontFamily: 'Nunito-Bold',
    lineHeight: 12,
  },
});
