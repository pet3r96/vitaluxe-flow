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

/**
 * Responsive container classes
 */
export const getResponsiveContainer = (): string => {
  return 'container mx-auto px-4 sm:px-6 lg:px-8 max-w-7xl';
};

/**
 * Responsive page wrapper
 */
export const getResponsivePageWrapper = (): string => {
  return 'space-y-4 sm:space-y-6';
};

/**
 * Responsive dialog width - Updated for mobile optimization
 * All dialogs should use max-w-[95vw] sm:max-w-* pattern for mobile
 */
export const getResponsiveDialogWidth = (size: 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '3xl' | '4xl' | '6xl' = 'md'): string => {
  const sizes = {
    sm: 'max-w-[95vw] sm:max-w-sm',
    md: 'max-w-[95vw] sm:max-w-md',
    lg: 'max-w-[95vw] sm:max-w-lg',
    xl: 'max-w-[95vw] sm:max-w-xl',
    '2xl': 'max-w-[95vw] sm:max-w-2xl',
    '3xl': 'max-w-[95vw] sm:max-w-3xl',
    '4xl': 'max-w-[95vw] sm:max-w-4xl',
    '6xl': 'max-w-[95vw] sm:max-w-6xl'
  };
  return sizes[size];
};

/**
 * Responsive card padding
 */
export const getResponsiveCardPadding = (): string => {
  return 'p-4 sm:p-6 lg:p-8';
};

/**
 * Responsive heading classes
 */
export const getResponsiveHeading = (level: 'h1' | 'h2' | 'h3' = 'h1'): string => {
  const headings = {
    h1: 'text-2xl sm:text-3xl lg:text-4xl font-bold',
    h2: 'text-xl sm:text-2xl lg:text-3xl font-bold',
    h3: 'text-lg sm:text-xl lg:text-2xl font-semibold'
  };
  return headings[level];
};
