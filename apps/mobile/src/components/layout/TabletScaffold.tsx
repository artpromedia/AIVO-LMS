import React from 'react';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useWindowSizeClass } from '../../design/useWindowSizeClass';
import { RoleNavigationRail, type RailDestination } from './RoleNavigationRail';
import { colors } from '@/constants/colors';

export interface TabletScaffoldProps {
  /**
   * Navigation destinations rendered as a left rail/drawer on tablets.
   * On compact phones, this scaffold renders ONLY its children — the
   * surrounding layout is expected to keep using bottom tabs there.
   */
  destinations: RailDestination[];
  /** Optional header rendered above the rail. */
  railHeader?: React.ReactNode;
  /** Optional footer rendered below the rail (e.g. profile / logout). */
  railFooter?: React.ReactNode;
  /** Background colour for the rail. */
  railBackground?: string;
  /** Active rail accent colour. */
  activeTint?: string;
  /** Inactive rail accent colour. */
  inactiveTint?: string;
  children: React.ReactNode;
}

/**
 * Tablet-first shell. On medium+ widths it renders a persistent
 * `RoleNavigationRail` on the left and the screen content on the right.
 * On phones, it renders children only so the existing bottom-tab navigator
 * stays untouched.
 *
 * Pair with role `_layout.tsx` files that hide the bottom tab bar on
 * tablet widths and forward the same destinations into this scaffold.
 */
export function TabletScaffold({
  destinations,
  railHeader,
  railFooter,
  railBackground,
  activeTint,
  inactiveTint,
  children,
}: TabletScaffoldProps) {
  const { isTablet } = useWindowSizeClass();
  const insets = useSafeAreaInsets();

  if (!isTablet) {
    return <View style={styles.flex}>{children}</View>;
  }

  return (
    <View style={[styles.row, { backgroundColor: colors.background }]}>
      <RoleNavigationRail
        destinations={destinations}
        header={railHeader}
        footer={railFooter}
        background={railBackground}
        activeTintColor={activeTint}
        inactiveTintColor={inactiveTint}
      />
      <View style={[styles.flex, { paddingBottom: insets.bottom }]}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  row: { flex: 1, flexDirection: 'row' },
});
