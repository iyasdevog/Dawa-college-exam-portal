import React, { createContext, useContext, ReactNode } from 'react';
import { useMobile, useMobileNavigation, MobileState, MobilePreferences } from '../hooks/useMobile';

interface MobileContextType extends MobileState {
    preferences: MobilePreferences;
    // Navigation state
    isMobileMenuOpen: boolean;
    toggleMobileMenu: () => void;
    closeMobileMenu: () => void;
    openMobileMenu: () => void;
    shouldShowMobileMenu: boolean;
    // Utility functions
    isMobileSize: boolean;
    isTabletSize: boolean;
    isDesktopSize: boolean;
    // Breakpoint helpers
    isXs: boolean;
    isSm: boolean;
    isMd: boolean;
    isLg: boolean;
    isXl: boolean;
}

const MobileContext = createContext<MobileContextType | undefined>(undefined);

interface MobileProviderProps {
    children: ReactNode;
}

/**
 * Mobile Context Provider
 * Provides consolidated mobile state and actions throughout the application
 */
export const MobileProvider: React.FC<MobileProviderProps> = ({ children }) => {
    const mobileState = useMobile();
    const navigation = useMobileNavigation();

    const contextValue: MobileContextType = {
        ...mobileState,
        ...navigation,
    };

    return (
        <MobileContext.Provider value={contextValue}>
            {children}
        </MobileContext.Provider>
    );
};

/**
 * Hook to access mobile context
 * Throws error if used outside MobileProvider
 */
export const useMobileContext = (): MobileContextType => {
    const context = useContext(MobileContext);

    if (context === undefined) {
        throw new Error('useMobileContext must be used within a MobileProvider');
    }

    return context;
};

/**
 * Hook for mobile-specific conditional rendering
 */
export const useMobileConditional = () => {
    const { isMobile, isTablet, isDesktop, screenSize } = useMobileContext();

    return {
        // Device type conditionals
        renderOnMobile: (component: ReactNode) => isMobile ? component : null,
        renderOnTablet: (component: ReactNode) => isTablet ? component : null,
        renderOnDesktop: (component: ReactNode) => isDesktop ? component : null,

        // Breakpoint conditionals
        renderOnXs: (component: ReactNode) => screenSize === 'xs' ? component : null,
        renderOnSm: (component: ReactNode) => screenSize === 'sm' ? component : null,
        renderOnMd: (component: ReactNode) => screenSize === 'md' ? component : null,
        renderOnLg: (component: ReactNode) => screenSize === 'lg' ? component : null,
        renderOnXl: (component: ReactNode) => screenSize === 'xl' ? component : null,

        // Range conditionals
        renderOnMobileUp: (component: ReactNode) => isMobile || isTablet || isDesktop ? component : null,
        renderOnTabletUp: (component: ReactNode) => isTablet || isDesktop ? component : null,
        renderOnDesktopUp: (component: ReactNode) => isDesktop ? component : null,

        // Utility functions
        isMobile,
        isTablet,
        isDesktop,
        screenSize,
    };
};