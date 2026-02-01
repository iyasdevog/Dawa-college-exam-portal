import React, { ReactNode, CSSProperties } from 'react';
import { useMobileContext } from '../viewmodels/MobileContext';

interface ResponsiveWrapperProps {
    children: ReactNode;
    className?: string;
    style?: CSSProperties;
    // Responsive display options
    hideOn?: ('mobile' | 'tablet' | 'desktop')[];
    showOn?: ('mobile' | 'tablet' | 'desktop')[];
    // Touch optimization
    touchOptimized?: boolean;
}

/**
 * Responsive Wrapper Component
 * Provides responsive behavior and mobile-first styling utilities
 */
export const ResponsiveWrapper: React.FC<ResponsiveWrapperProps> = ({
    children,
    className = '',
    style = {},
    hideOn = [],
    showOn = [],
    touchOptimized = false,
}) => {
    const { isMobile, isTablet, isDesktop, isTouchDevice } = useMobileContext();

    // Determine visibility
    const shouldHide = hideOn.some(device => {
        switch (device) {
            case 'mobile': return isMobile;
            case 'tablet': return isTablet;
            case 'desktop': return isDesktop;
            default: return false;
        }
    });

    const shouldShow = showOn.length === 0 || showOn.some(device => {
        switch (device) {
            case 'mobile': return isMobile;
            case 'tablet': return isTablet;
            case 'desktop': return isDesktop;
            default: return false;
        }
    });

    if (shouldHide || !shouldShow) {
        return null;
    }

    // Build responsive styles
    const responsiveStyles: CSSProperties = {
        ...style,
        ...(touchOptimized && isTouchDevice && {
            WebkitTapHighlightColor: 'transparent',
            userSelect: 'none',
        }),
    };

    // Build responsive classes
    const responsiveClasses = [
        className,
        touchOptimized && isTouchDevice ? 'touch-optimized' : '',
        isMobile ? 'mobile-device' : '',
        isTablet ? 'tablet-device' : '',
        isDesktop ? 'desktop-device' : '',
    ].filter(Boolean).join(' ');

    return (
        <div className={responsiveClasses} style={responsiveStyles}>
            {children}
        </div>
    );
};

/**
 * Mobile-First Typography Component
 * Provides responsive typography with mobile-optimized scaling
 */
interface ResponsiveTextProps {
    children: ReactNode;
    variant?: 'display-large' | 'display-medium' | 'display-small' |
    'heading-large' | 'heading-medium' | 'heading-small' |
    'body-large' | 'body-medium' | 'body-small' | 'caption';
    className?: string;
    style?: CSSProperties;
    as?: keyof React.JSX.IntrinsicElements;
}

export const ResponsiveText: React.FC<ResponsiveTextProps> = ({
    children,
    variant = 'body-medium',
    className = '',
    style = {},
    as: Component = 'span',
}) => {
    const getTypographyStyle = (variant: string): CSSProperties => {
        const styles: Record<string, CSSProperties> = {
            'display-large': { fontSize: '2.5rem', fontWeight: 'bold', lineHeight: '1.2' },
            'display-medium': { fontSize: '2rem', fontWeight: 'bold', lineHeight: '1.3' },
            'display-small': { fontSize: '1.75rem', fontWeight: 'bold', lineHeight: '1.3' },
            'heading-large': { fontSize: '1.5rem', fontWeight: '600', lineHeight: '1.4' },
            'heading-medium': { fontSize: '1.25rem', fontWeight: '600', lineHeight: '1.4' },
            'heading-small': { fontSize: '1.125rem', fontWeight: '600', lineHeight: '1.4' },
            'body-large': { fontSize: '1.125rem', fontWeight: 'normal', lineHeight: '1.6' },
            'body-medium': { fontSize: '1rem', fontWeight: 'normal', lineHeight: '1.6' },
            'body-small': { fontSize: '0.875rem', fontWeight: 'normal', lineHeight: '1.6' },
            'caption': { fontSize: '0.75rem', fontWeight: 'normal', lineHeight: '1.5' },
        };
        return styles[variant] || styles['body-medium'];
    };

    const typographyStyle = getTypographyStyle(variant);
    const combinedStyle: CSSProperties = { ...typographyStyle, ...style };

    return (
        <Component className={className} style={combinedStyle}>
            {children}
        </Component>
    );
};

/**
 * Mobile-First Container Component
 * Provides responsive container with mobile-optimized padding and max-widths
 */
interface ResponsiveContainerProps {
    children: ReactNode;
    className?: string;
    style?: CSSProperties;
    center?: boolean;
}

export const ResponsiveContainer: React.FC<ResponsiveContainerProps> = ({
    children,
    className = '',
    style = {},
    center = true,
}) => {
    const { isMobile } = useMobileContext();

    const containerStyle: CSSProperties = {
        width: '100%',
        padding: isMobile ? '1rem' : '2rem',
        maxWidth: isMobile ? '100%' : '1200px',
        ...style,
        ...(center && { margin: '0 auto' }),
    };

    return (
        <div className={`container-mobile ${className}`} style={containerStyle}>
            {children}
        </div>
    );
};

/**
 * Mobile-First Grid Component
 * Provides responsive grid with mobile-first column management
 */
interface ResponsiveGridProps {
    children: ReactNode;
    className?: string;
    style?: CSSProperties;
    columns?: number;
    minItemWidth?: string;
}

export const ResponsiveGrid: React.FC<ResponsiveGridProps> = ({
    children,
    className = '',
    style = {},
    columns,
    minItemWidth = '250px',
}) => {
    const { isMobile, isTablet } = useMobileContext();

    const getColumns = () => {
        if (columns) return columns;
        if (isMobile) return 1;
        if (isTablet) return 2;
        return 3;
    };

    const gridStyle: CSSProperties = {
        display: 'grid',
        gap: isMobile ? '1rem' : '2rem',
        gridTemplateColumns: columns
            ? `repeat(${getColumns()}, 1fr)`
            : `repeat(auto-fit, minmax(${minItemWidth}, 1fr))`,
        ...style,
    };

    return (
        <div className={`mobile-grid ${className}`} style={gridStyle}>
            {children}
        </div>
    );
};