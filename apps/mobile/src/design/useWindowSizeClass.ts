import { useMemo } from 'react';
import { useWindowDimensions } from 'react-native';
import { classifyWidth, isTabletWidth, type SizeClass } from './responsive';

export interface WindowSizeClass {
  width: number;
  height: number;
  sizeClass: SizeClass;
  isTablet: boolean;
  isCompact: boolean;
  isMedium: boolean;
  isExpanded: boolean;
  isLandscape: boolean;
}

/**
 * Resolve the active size class from RN's window dimensions.
 *
 * Re-renders on rotation, multitasking split view changes, and external
 * display attach/detach.
 */
export function useWindowSizeClass(): WindowSizeClass {
  const { width, height } = useWindowDimensions();
  return useMemo<WindowSizeClass>(() => {
    const sizeClass = classifyWidth(width);
    return {
      width,
      height,
      sizeClass,
      isTablet: isTabletWidth(width),
      isCompact: sizeClass === 'compact',
      isMedium: sizeClass === 'medium',
      isExpanded: sizeClass === 'expanded',
      isLandscape: width > height,
    };
  }, [width, height]);
}
