import { BRAND } from '@aivo/brand';

export const theme = {
  colors: {
    primary: BRAND.colors.primary,
    primaryLight: BRAND.colors.primaryLight,
    primaryDark: BRAND.colors.primaryDark,
    secondary: BRAND.colors.secondary,
    accent: BRAND.colors.accent,
    success: BRAND.colors.success,
    warning: BRAND.colors.warning,
    error: BRAND.colors.error,
    info: BRAND.colors.info,
    navy: '#1A1A2E',
    background: BRAND.colors.background,
    card: '#FFFFFF',
    surface: BRAND.colors.surface,
    surfaceSoft: BRAND.colors.visualSurfaceSoft,
    text: BRAND.colors.text,
    textSecondary: BRAND.colors.textSecondary,
    border: BRAND.colors.border,
    visualMath: BRAND.colors.visualMath,
    visualReading: BRAND.colors.visualReading,
    visualScience: BRAND.colors.visualScience,
    visualSel: BRAND.colors.visualSel,
  },
  spacing: {
    xs: 4,
    sm: 8,
    md: 16,
    lg: 24,
    xl: 32,
    xxl: 48,
  },
  radius: {
    sm: 6,
    md: 8,
    lg: 12,
    xl: 16,
    xxl: 24,
    full: 9999,
  },
  shadows: {
    sm: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.05,
      shadowRadius: 2,
      elevation: 1,
    },
    md: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 4,
      elevation: 3,
    },
    lg: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.15,
      shadowRadius: 8,
      elevation: 5,
    },
  },
  fonts: {
    heading: 'Nunito-ExtraBold',
    headingSemiBold: 'Nunito-SemiBold',
    body: 'Nunito-Regular',
    bodyBold: 'Nunito-Bold',
    mono: 'JetBrainsMono-Regular',
  },
  /**
   * Tablet-aware breakpoints — kept here so every package and screen
   * agrees on the same compact/medium/expanded boundaries. Match
   * Material 3 / iPadOS size classes.
   */
  breakpoints: {
    compact: 0,
    medium: 600,
    expanded: 840,
    xlarge: 1200,
  },
  /**
   * Recommended content-width caps so cards and forms don't stretch
   * edge-to-edge on tablet hardware.
   */
  contentMaxWidth: {
    reading: 720,
    dashboard: 1080,
    workspace: 1280,
  },
} as const;

export type SizeClass = 'compact' | 'medium' | 'expanded';

export function classifySizeClass(width: number): SizeClass {
  if (width >= theme.breakpoints.expanded) return 'expanded';
  if (width >= theme.breakpoints.medium) return 'medium';
  return 'compact';
}

export function isTabletWidth(width: number): boolean {
  return width >= theme.breakpoints.medium;
}
