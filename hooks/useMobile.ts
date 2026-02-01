import { useState, useEffect, useCallback } from 'react';

export type ScreenSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl';
export type Orientation = 'portrait' | 'landscape';

export interface MobileState {
    isMobile: boolean;
    isTablet: boolean;
    isDesktop: boolean;
    screenSize: ScreenSize;
    screenWidth: number;
    screenHeight: number;
    orientation: Orientation;
    isTouchDevice: boolean;
    isIOS: boolean;
    isAndroid: boolean;
    pixelRatio: number;
}

export interface MobilePreferences {
    reducedMotion: boolean;
    highContrast: boolean;
    prefersDarkMode: boolean;
}

/**
 * Consolidated Mobile Detection Hook
 * Provides comprehensive mobile device detection and responsive state management
 */
export const useMobile = () => {
    const [mobileState, setMobileState] = useState<MobileState>(() => {
        if (typeof window === 'undefined') {
            return {
                isMobile: false,
                isTablet: false,
                isDesktop: true,
                screenSize: 'lg' as ScreenSize,
                screenWidth: 1024,
                screenHeight: 768,
                orientation: 'landscape' as Orientation,
                isTouchDevice: false,
                isIOS: false,
                isAndroid: false,
                pixelRatio: 1,
            };
        }
        return getInitialMobileState();
    });

    const [preferences, setPreferences] = useState<MobilePreferences>(() => {
        if (typeof window === 'undefined') {
            return {
                reducedMotion: false,
                highContrast: false,
                prefersDarkMode: false,
            };
        }
        return getInitialPreferences();
    });

    useEffect(() => {
        if (typeof window === 'undefined') return;

        setMobileState(getInitialMobileState());
        setPreferences(getInitialPreferences());

        const handleResize = () => {
            setMobileState(getInitialMobileState());
        };

        const handleOrientationChange = () => {
            setTimeout(() => {
                setMobileState(getInitialMobileState());
            }, 100);
        };

        let resizeTimeout: NodeJS.Timeout;
        const debouncedResize = () => {
            clearTimeout(resizeTimeout);
            resizeTimeout = setTimeout(handleResize, 150);
        };

        window.addEventListener('resize', debouncedResize);
        window.addEventListener('orientationchange', handleOrientationChange);

        const mediaQueries = [
            window.matchMedia('(prefers-reduced-motion: reduce)'),
            window.matchMedia('(prefers-contrast: high)'),
            window.matchMedia('(prefers-color-scheme: dark)'),
        ];

        const handleMediaQueryChange = () => {
            setPreferences(getInitialPreferences());
        };

        mediaQueries.forEach(mq => {
            mq.addEventListener('change', handleMediaQueryChange);
        });

        return () => {
            clearTimeout(resizeTimeout);
            window.removeEventListener('resize', debouncedResize);
            window.removeEventListener('orientationchange', handleOrientationChange);
            mediaQueries.forEach(mq => {
                mq.removeEventListener('change', handleMediaQueryChange);
            });
        };
    }, []);

    return {
        ...mobileState,
        preferences,
        // Utility functions
        isMobileSize: mobileState.screenWidth < 768,
        isTabletSize: mobileState.screenWidth >= 768 && mobileState.screenWidth < 1024,
        isDesktopSize: mobileState.screenWidth >= 1024,
        // Breakpoint helpers
        isXs: mobileState.screenSize === 'xs',
        isSm: mobileState.screenSize === 'sm',
        isMd: mobileState.screenSize === 'md',
        isLg: mobileState.screenSize === 'lg',
        isXl: mobileState.screenSize === 'xl',
    };
};

/**
 * Mobile Navigation Hook
 * Manages mobile menu state and navigation
 */
export const useMobileNavigation = () => {
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
    const { isMobile } = useMobile();

    const toggleMobileMenu = useCallback(() => {
        setIsMobileMenuOpen(prev => !prev);
    }, []);

    const closeMobileMenu = useCallback(() => {
        setIsMobileMenuOpen(false);
    }, []);

    const openMobileMenu = useCallback(() => {
        setIsMobileMenuOpen(true);
    }, []);

    // Close mobile menu when switching to desktop
    useEffect(() => {
        if (!isMobile && isMobileMenuOpen) {
            setIsMobileMenuOpen(false);
        }
    }, [isMobile, isMobileMenuOpen]);

    // Prevent body scroll when mobile menu is open
    useEffect(() => {
        if (isMobileMenuOpen && isMobile) {
            document.body.style.overflow = 'hidden';
        } else {
            document.body.style.overflow = '';
        }

        return () => {
            document.body.style.overflow = '';
        };
    }, [isMobileMenuOpen, isMobile]);

    return {
        isMobileMenuOpen,
        toggleMobileMenu,
        closeMobileMenu,
        openMobileMenu,
        shouldShowMobileMenu: isMobile,
    };
};

/**
 * Touch Interaction Hook
 * Provides touch-friendly interaction utilities
 */
export const useTouchInteraction = () => {
    const { isTouchDevice, isMobile } = useMobile();
    const [isPressed, setIsPressed] = useState(false);

    const handleTouchStart = useCallback(() => {
        if (isTouchDevice) {
            setIsPressed(true);
        }
    }, [isTouchDevice]);

    const handleTouchEnd = useCallback(() => {
        if (isTouchDevice) {
            setIsPressed(false);
        }
    }, [isTouchDevice]);

    return {
        isTouchDevice,
        isMobile,
        isPressed,
        touchHandlers: {
            onTouchStart: handleTouchStart,
            onTouchEnd: handleTouchEnd,
        },
        getTouchProps: (onClick?: () => void) => ({
            onClick,
            onTouchStart: handleTouchStart,
            onTouchEnd: handleTouchEnd,
            style: {
                WebkitTapHighlightColor: 'transparent',
                userSelect: 'none' as const,
                cursor: 'pointer',
            },
        }),
    };
};

/**
 * Get initial mobile state based on current window properties
 */
function getInitialMobileState(): MobileState {
    const width = window.innerWidth;
    const height = window.innerHeight;
    const userAgent = navigator.userAgent;

    // Determine screen size based on mobile-first breakpoints
    let screenSize: ScreenSize = 'xs';
    if (width >= 1280) screenSize = 'xl';
    else if (width >= 1024) screenSize = 'lg';
    else if (width >= 768) screenSize = 'md';
    else if (width >= 640) screenSize = 'sm';

    // Device detection
    const isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
    const isIOS = /iPad|iPhone|iPod/.test(userAgent);
    const isAndroid = /Android/.test(userAgent);

    // Mobile/tablet/desktop classification
    const isMobile = width < 768;
    const isTablet = width >= 768 && width < 1024;
    const isDesktop = width >= 1024;

    // Orientation
    const orientation: Orientation = height > width ? 'portrait' : 'landscape';

    return {
        isMobile,
        isTablet,
        isDesktop,
        screenSize,
        screenWidth: width,
        screenHeight: height,
        orientation,
        isTouchDevice,
        isIOS,
        isAndroid,
        pixelRatio: window.devicePixelRatio || 1,
    };
}

/**
 * Get initial user preferences from media queries
 */
function getInitialPreferences(): MobilePreferences {
    return {
        reducedMotion: window.matchMedia('(prefers-reduced-motion: reduce)').matches,
        highContrast: window.matchMedia('(prefers-contrast: high)').matches,
        prefersDarkMode: window.matchMedia('(prefers-color-scheme: dark)').matches,
    };
}