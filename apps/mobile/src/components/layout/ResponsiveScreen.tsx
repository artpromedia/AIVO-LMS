import React from 'react';
import {
  ScrollView,
  ScrollViewProps,
  StyleSheet,
  View,
  ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useWindowSizeClass } from '../../design/useWindowSizeClass';
import { CONTENT_MAX_WIDTH, pickBySizeClass } from '../../design/responsive';
import { colors, spacing } from '@/constants/colors';

export type ContentWidth = keyof typeof CONTENT_MAX_WIDTH | 'full';

export interface ResponsiveScreenProps extends ScrollViewProps {
  /** Centered max content width. 'full' = stretch to screen edges. */
  maxWidth?: ContentWidth;
  /** Apply safe-area top inset to the content. Default: true. */
  applyTopInset?: boolean;
  /** Override horizontal padding. Default: scales with size class. */
  horizontalPadding?: number;
  /** Render without a ScrollView wrapper. */
  scroll?: boolean;
  /** Background colour override. */
  background?: string;
  innerStyle?: ViewStyle;
  children?: React.ReactNode;
}

/**
 * Shared screen scaffold that:
 *   - applies safe-area top inset
 *   - scales horizontal padding by size class (16/24/32)
 *   - caps content width on tablets so cards don't stretch edge-to-edge
 *
 * Use this in place of bare ScrollView/View at the top of every screen.
 */
export function ResponsiveScreen({
  maxWidth = 'full',
  applyTopInset = true,
  horizontalPadding,
  scroll = true,
  background,
  innerStyle,
  contentContainerStyle,
  style,
  children,
  ...rest
}: ResponsiveScreenProps) {
  const insets = useSafeAreaInsets();
  const { sizeClass, width } = useWindowSizeClass();
  const hPad =
    horizontalPadding ??
    pickBySizeClass(sizeClass, {
      compact: spacing.md,
      medium: spacing.lg,
      expanded: spacing.xl,
    });
  const cap = maxWidth === 'full' ? width : CONTENT_MAX_WIDTH[maxWidth];
  const contentWidth = Math.min(width - hPad * 2, cap);

  const inner = (
    <View
      style={[
        styles.inner,
        { width: contentWidth, alignSelf: 'center' },
        innerStyle,
      ]}
    >
      {children}
    </View>
  );

  const bgStyle = { backgroundColor: background ?? colors.background };

  if (!scroll) {
    return (
      <View
        style={[styles.container, bgStyle, { paddingHorizontal: hPad }, style as ViewStyle]}
      >
        {applyTopInset ? <View style={{ height: insets.top }} /> : null}
        {inner}
      </View>
    );
  }

  return (
    <ScrollView
      style={[styles.container, bgStyle, style]}
      contentContainerStyle={[
        { paddingTop: applyTopInset ? insets.top + 16 : 16, paddingHorizontal: hPad, paddingBottom: 32 },
        contentContainerStyle,
      ]}
      keyboardShouldPersistTaps="handled"
      {...rest}
    >
      {inner}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  inner: { width: '100%' },
});
