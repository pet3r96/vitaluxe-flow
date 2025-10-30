/**
 * Responsive utility functions for consistent breakpoint handling
 */

export const BREAKPOINTS = {
  mobile: 768,
  tablet: 1024,
  desktop: 1280,
} as const;

export const isMobileWidth = (width: number): boolean => width < BREAKPOINTS.mobile;
export const isTabletWidth = (width: number): boolean => 
  width >= BREAKPOINTS.mobile && width < BREAKPOINTS.tablet;
export const isDesktopWidth = (width: number): boolean => width >= BREAKPOINTS.tablet;

/**
 * Get responsive grid columns based on device width
 */
export const getResponsiveColumns = (width: number): number => {
  if (isMobileWidth(width)) return 1;
  if (isTabletWidth(width)) return 2;
  return 3;
};

/**
 * Get responsive card width class
 */
export const getResponsiveCardClass = (isMobile: boolean, isTablet: boolean): string => {
  if (isMobile) return 'w-full';
  if (isTablet) return 'w-full sm:w-1/2';
  return 'w-full md:w-1/3';
};

/**
 * Get responsive padding class
 */
export const getResponsivePadding = (isMobile: boolean): string => {
  return isMobile ? 'p-2' : 'p-4 md:p-6';
};

/**
 * Get responsive gap class
 */
export const getResponsiveGap = (isMobile: boolean): string => {
  return isMobile ? 'gap-2' : 'gap-4';
};
