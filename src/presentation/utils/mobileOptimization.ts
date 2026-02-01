/**
 * Mobile-First Responsive Design Utilities
 * Implements Requirements 8.1, 8.2 - Mobile interface optimization and responsive layout adaptation
 */

export interface TouchTargetConfig {
    size: 'min' | 'comfortable' | 'large';
    feedback: boolean;
    haptic?: boolean;
}

export interface ResponsiveBreakpoints {
    xs: number;  // 0px
    sm: number;  // 640px
    md: number;  // 768px
    lg: number;  // 1024px
    xl: number;  // 1280px
}

export const BREAKPOINTS: ResponsiveBreakpoints = {
    xs: 0,
    sm: 640,
    md: 768,
    lg: 1024,
    xl: 1280
};

export const TOUCH_TARGET_SIZES = {
    min: 44,        // Minimum WCAG AA compliant touch target
    comfortable: 48, // Comfortable touch target for most users
    large: 56       // Large touch target for accessibility
};

/**
 * Get optimal touch target size based on device and context
 */
export const getTouchTargetSize = (
    config: TouchTargetConfig,
    isMobile: boolean,
    isTablet: boolean
): string => {
    const baseSize = TOUCH_TARGET_SIZES[config.size];

    // Increase size on mobile for better usability
    if (isMobile) {
        return `${Math.max(baseSize, TOUCH_TARGET_SIZES.comfortable)}px`;
    }

    // Standard size for tablet and desktop
    return `${baseSize}px`;
};

/**
 * Generate responsive CSS classes based on screen size
 */
export const getResponsiveClasses = (
    screenWidth: number,
    mobileClasses: string,
    tabletClasses: string,
    desktopClasses: string
): string => {
    if (screenWidth < BREAKPOINTS.md) {
        return mobileClasses;
    } else if (screenWidth < BREAKPOINTS.lg) {
        return tabletClasses;
    } else {
        return desktopClasses;
    }
};

/**
 * Calculate optimal grid columns based on screen size and content
 */
export const getOptimalGridColumns = (
    screenWidth: number,
    itemCount: number,
    minItemWidth: number = 250
): number => {
    const availableWidth = screenWidth - 32; // Account for padding
    const maxColumns = Math.floor(availableWidth / minItemWidth);

    if (screenWidth < BREAKPOINTS.sm) {
        return 1; // Always single column on small mobile
    } else if (screenWidth < BREAKPOINTS.md) {
        return Math.min(2, maxColumns, itemCount); // Max 2 columns on large mobile
    } else if (screenWidth < BREAKPOINTS.lg) {
        return Math.min(3, maxColumns, itemCount); // Max 3 columns on tablet
    } else {
        return Math.min(4, maxColumns, itemCount); // Max 4 columns on desktop
    }
};

/**
 * Generate mobile-optimized spacing based on screen size
 */
export const getMobileSpacing = (
    size: 'xs' | 'sm' | 'md' | 'lg' | 'xl',
    screenWidth: number
): string => {
    const spacingMap = {
        xs: { mobile: '0.25rem', tablet: '0.5rem', desktop: '0.5rem' },
        sm: { mobile: '0.5rem', tablet: '0.75rem', desktop: '1rem' },
        md: { mobile: '1rem', tablet: '1.25rem', desktop: '1.5rem' },
        lg: { mobile: '1.5rem', tablet: '2rem', desktop: '2.5rem' },
        xl: { mobile: '2rem', tablet: '2.5rem', desktop: '3rem' }
    };

    const spacing = spacingMap[size];

    if (screenWidth < BREAKPOINTS.md) {
        return spacing.mobile;
    } else if (screenWidth < BREAKPOINTS.lg) {
        return spacing.tablet;
    } else {
        return spacing.desktop;
    }
};

/**
 * Generate mobile-optimized typography scale
 */
export const getMobileTypography = (
    variant: 'display' | 'heading' | 'body' | 'caption',
    level: 'large' | 'medium' | 'small',
    screenWidth: number
): { fontSize: string; lineHeight: string; fontWeight: string } => {
    const typographyMap = {
        display: {
            large: {
                mobile: { fontSize: '2rem', lineHeight: '1.2', fontWeight: 'bold' },
                tablet: { fontSize: '2.5rem', lineHeight: '1.2', fontWeight: 'bold' },
                desktop: { fontSize: '3rem', lineHeight: '1.1', fontWeight: 'bold' }
            },
            medium: {
                mobile: { fontSize: '1.75rem', lineHeight: '1.3', fontWeight: 'bold' },
                tablet: { fontSize: '2rem', lineHeight: '1.2', fontWeight: 'bold' },
                desktop: { fontSize: '2.5rem', lineHeight: '1.2', fontWeight: 'bold' }
            },
            small: {
                mobile: { fontSize: '1.5rem', lineHeight: '1.3', fontWeight: 'bold' },
                tablet: { fontSize: '1.75rem', lineHeight: '1.3', fontWeight: 'bold' },
                desktop: { fontSize: '2rem', lineHeight: '1.2', fontWeight: 'bold' }
            }
        },
        heading: {
            large: {
                mobile: { fontSize: '1.25rem', lineHeight: '1.4', fontWeight: '600' },
                tablet: { fontSize: '1.5rem', lineHeight: '1.4', fontWeight: '600' },
                desktop: { fontSize: '1.75rem', lineHeight: '1.3', fontWeight: '600' }
            },
            medium: {
                mobile: { fontSize: '1.125rem', lineHeight: '1.4', fontWeight: '600' },
                tablet: { fontSize: '1.25rem', lineHeight: '1.4', fontWeight: '600' },
                desktop: { fontSize: '1.5rem', lineHeight: '1.4', fontWeight: '600' }
            },
            small: {
                mobile: { fontSize: '1rem', lineHeight: '1.4', fontWeight: '600' },
                tablet: { fontSize: '1.125rem', lineHeight: '1.4', fontWeight: '600' },
                desktop: { fontSize: '1.25rem', lineHeight: '1.4', fontWeight: '600' }
            }
        },
        body: {
            large: {
                mobile: { fontSize: '1rem', lineHeight: '1.6', fontWeight: 'normal' },
                tablet: { fontSize: '1.125rem', lineHeight: '1.6', fontWeight: 'normal' },
                desktop: { fontSize: '1.125rem', lineHeight: '1.6', fontWeight: 'normal' }
            },
            medium: {
                mobile: { fontSize: '0.875rem', lineHeight: '1.6', fontWeight: 'normal' },
                tablet: { fontSize: '1rem', lineHeight: '1.6', fontWeight: 'normal' },
                desktop: { fontSize: '1rem', lineHeight: '1.6', fontWeight: 'normal' }
            },
            small: {
                mobile: { fontSize: '0.75rem', lineHeight: '1.5', fontWeight: 'normal' },
                tablet: { fontSize: '0.875rem', lineHeight: '1.6', fontWeight: 'normal' },
                desktop: { fontSize: '0.875rem', lineHeight: '1.6', fontWeight: 'normal' }
            }
        },
        caption: {
            large: {
                mobile: { fontSize: '0.875rem', lineHeight: '1.5', fontWeight: 'normal' },
                tablet: { fontSize: '0.875rem', lineHeight: '1.5', fontWeight: 'normal' },
                desktop: { fontSize: '0.875rem', lineHeight: '1.5', fontWeight: 'normal' }
            },
            medium: {
                mobile: { fontSize: '0.75rem', lineHeight: '1.5', fontWeight: 'normal' },
                tablet: { fontSize: '0.75rem', lineHeight: '1.5', fontWeight: 'normal' },
                desktop: { fontSize: '0.75rem', lineHeight: '1.5', fontWeight: 'normal' }
            },
            small: {
                mobile: { fontSize: '0.625rem', lineHeight: '1.4', fontWeight: 'normal' },
                tablet: { fontSize: '0.625rem', lineHeight: '1.4', fontWeight: 'normal' },
                desktop: { fontSize: '0.625rem', lineHeight: '1.4', fontWeight: 'normal' }
            }
        }
    };

    const typography = typographyMap[variant][level];

    if (screenWidth < BREAKPOINTS.md) {
        return typography.mobile;
    } else if (screenWidth < BREAKPOINTS.lg) {
        return typography.tablet;
    } else {
        return typography.desktop;
    }
};

/**
 * Touch feedback utilities for enhanced mobile interaction
 */
export const createTouchFeedback = (element: HTMLElement, type: 'scale' | 'opacity' | 'both' = 'both') => {
    const handleTouchStart = () => {
        element.style.transition = 'transform 0.1s ease-out, opacity 0.1s ease-out';

        if (type === 'scale' || type === 'both') {
            element.style.transform = 'scale(0.98)';
        }

        if (type === 'opacity' || type === 'both') {
            element.style.opacity = '0.8';
        }
    };

    const handleTouchEnd = () => {
        element.style.transform = 'scale(1)';
        element.style.opacity = '1';

        // Remove transition after animation completes
        setTimeout(() => {
            element.style.transition = '';
        }, 100);
    };

    element.addEventListener('touchstart', handleTouchStart, { passive: true });
    element.addEventListener('touchend', handleTouchEnd, { passive: true });
    element.addEventListener('touchcancel', handleTouchEnd, { passive: true });

    // Return cleanup function
    return () => {
        element.removeEventListener('touchstart', handleTouchStart);
        element.removeEventListener('touchend', handleTouchEnd);
        element.removeEventListener('touchcancel', handleTouchEnd);
    };
};

/**
 * Optimize form inputs for mobile devices
 */
export const getMobileInputProps = (
    inputType: 'text' | 'number' | 'email' | 'tel' | 'search',
    isMobile: boolean
) => {
    const baseProps = {
        autoComplete: 'off',
        autoCorrect: 'off',
        autoCapitalize: 'off',
        spellCheck: false
    };

    if (!isMobile) {
        return baseProps;
    }

    // Mobile-specific optimizations
    const mobileProps = {
        ...baseProps,
        inputMode: inputType === 'number' ? 'numeric' as const : 'text' as const,
        pattern: inputType === 'number' ? '[0-9]*' : undefined,
        // Prevent zoom on iOS
        style: { fontSize: '16px' }
    };

    return mobileProps;
};

/**
 * Generate mobile-optimized container styles
 */
export const getMobileContainerStyles = (
    screenWidth: number,
    maxWidth: 'sm' | 'md' | 'lg' | 'xl' | 'full' = 'lg'
): React.CSSProperties => {
    const maxWidthMap = {
        sm: 640,
        md: 768,
        lg: 1024,
        xl: 1280,
        full: '100%'
    };

    const padding = getMobileSpacing('lg', screenWidth);

    return {
        width: '100%',
        maxWidth: typeof maxWidthMap[maxWidth] === 'number' ? `${maxWidthMap[maxWidth]}px` : maxWidthMap[maxWidth],
        margin: '0 auto',
        padding: `0 ${padding}`,
        // Ensure safe area support on mobile devices
        paddingLeft: screenWidth < BREAKPOINTS.md ? `max(${padding}, env(safe-area-inset-left))` : padding,
        paddingRight: screenWidth < BREAKPOINTS.md ? `max(${padding}, env(safe-area-inset-right))` : padding
    };
};

/**
 * Detect and handle orientation changes smoothly
 */
export const createOrientationHandler = (callback: (orientation: 'portrait' | 'landscape') => void) => {
    let orientationTimeout: NodeJS.Timeout;

    const handleOrientationChange = () => {
        // Clear existing timeout
        if (orientationTimeout) {
            clearTimeout(orientationTimeout);
        }

        // Add transition class to body
        document.body.classList.add('orientation-changing');

        // Delay callback to allow for smooth transition
        orientationTimeout = setTimeout(() => {
            const orientation = window.innerHeight > window.innerWidth ? 'portrait' : 'landscape';
            callback(orientation);

            // Remove transition class after callback
            setTimeout(() => {
                document.body.classList.remove('orientation-changing');
            }, 300);
        }, 100);
    };

    // Listen for orientation change events
    window.addEventListener('orientationchange', handleOrientationChange);
    window.addEventListener('resize', handleOrientationChange);

    // Return cleanup function
    return () => {
        if (orientationTimeout) {
            clearTimeout(orientationTimeout);
        }
        window.removeEventListener('orientationchange', handleOrientationChange);
        window.removeEventListener('resize', handleOrientationChange);
    };
};

/**
 * Create mobile-optimized scroll behavior
 */
export const createMobileScrollHandler = (options: {
    onScrollStart?: () => void;
    onScrollEnd?: () => void;
    threshold?: number;
}) => {
    let scrollTimeout: NodeJS.Timeout;
    let isScrolling = false;

    const handleScroll = () => {
        if (!isScrolling && options.onScrollStart) {
            options.onScrollStart();
            isScrolling = true;
        }

        // Clear existing timeout
        if (scrollTimeout) {
            clearTimeout(scrollTimeout);
        }

        // Set timeout for scroll end
        scrollTimeout = setTimeout(() => {
            if (options.onScrollEnd) {
                options.onScrollEnd();
            }
            isScrolling = false;
        }, options.threshold || 150);
    };

    // Use passive listeners for better performance
    window.addEventListener('scroll', handleScroll, { passive: true });

    // Return cleanup function
    return () => {
        if (scrollTimeout) {
            clearTimeout(scrollTimeout);
        }
        window.removeEventListener('scroll', handleScroll);
    };
};

/**
 * Utility to check if device supports hover
 */
export const supportsHover = (): boolean => {
    return window.matchMedia('(hover: hover)').matches;
};

/**
 * Utility to check if device prefers reduced motion
 */
export const prefersReducedMotion = (): boolean => {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
};

/**
 * Generate mobile-optimized animation duration
 */
export const getMobileAnimationDuration = (baseDuration: number): number => {
    if (prefersReducedMotion()) {
        return 0.01; // Nearly instant for reduced motion
    }

    // Slightly faster animations on mobile for better perceived performance
    return baseDuration * 0.8;
};