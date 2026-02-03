import React, { forwardRef, useEffect, useRef } from 'react';
import { useMobile, useTouchInteraction } from '../hooks/useMobile';
import { getTouchTargetSize, createTouchFeedback, prefersReducedMotion } from '../utils/mobileOptimization';

interface MobileButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
    variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger';
    size?: 'sm' | 'md' | 'lg';
    touchSize?: 'min' | 'comfortable' | 'large';
    fullWidth?: boolean;
    loading?: boolean;
    icon?: string;
    iconPosition?: 'left' | 'right';
    children: React.ReactNode;
    hapticFeedback?: boolean;
}

/**
 * Mobile-First Button Component
 * Implements Requirements 8.1 - Mobile interface optimization with proper touch targets
 * Ensures minimum 44px touch targets as per WCAG guidelines
 */
export const MobileButton = forwardRef<HTMLButtonElement, MobileButtonProps>(({
    variant = 'primary',
    size = 'md',
    touchSize = 'comfortable',
    fullWidth = false,
    loading = false,
    icon,
    iconPosition = 'left',
    children,
    className = '',
    disabled,
    hapticFeedback = false,
    onClick,
    ...props
}, ref) => {
    const { isMobile, isTablet, screenWidth } = useMobile();
    const { getTouchProps } = useTouchInteraction();
    const buttonRef = useRef<HTMLButtonElement>(null);

    // Combine refs
    const combinedRef = (node: HTMLButtonElement) => {
        buttonRef.current = node;
        if (typeof ref === 'function') {
            ref(node);
        } else if (ref) {
            ref.current = node;
        }
    };

    // Add touch feedback effect
    useEffect(() => {
        const button = buttonRef.current;
        if (!button || !isMobile || prefersReducedMotion()) return;

        const cleanup = createTouchFeedback(button, 'both');
        return cleanup;
    }, [isMobile]);

    // Handle click with haptic feedback
    const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
        if (disabled || loading) return;

        // Trigger haptic feedback on supported devices
        if (hapticFeedback && 'vibrate' in navigator && isMobile) {
            navigator.vibrate(10); // Short vibration
        }

        if (onClick) {
            onClick(e);
        }
    };

    // Get variant styles
    const getVariantStyles = () => {
        const variants = {
            primary: 'bg-emerald-600 text-white hover:bg-emerald-700 active:bg-emerald-800 shadow-lg hover:shadow-xl',
            secondary: 'bg-slate-600 text-white hover:bg-slate-700 active:bg-slate-800 shadow-lg hover:shadow-xl',
            outline: 'border-2 border-emerald-600 text-emerald-600 hover:bg-emerald-50 active:bg-emerald-100',
            ghost: 'text-slate-600 hover:bg-slate-100 active:bg-slate-200',
            danger: 'bg-red-600 text-white hover:bg-red-700 active:bg-red-800 shadow-lg hover:shadow-xl'
        };
        return variants[variant];
    };

    // Get size styles with mobile optimization
    const getSizeStyles = () => {
        const sizes = {
            sm: {
                mobile: 'px-3 py-2 text-sm',
                tablet: 'px-4 py-2 text-sm',
                desktop: 'px-4 py-2 text-sm'
            },
            md: {
                mobile: 'px-4 py-3 text-base',
                tablet: 'px-6 py-3 text-base',
                desktop: 'px-6 py-3 text-base'
            },
            lg: {
                mobile: 'px-6 py-4 text-lg',
                tablet: 'px-8 py-4 text-lg',
                desktop: 'px-8 py-4 text-lg'
            }
        };

        const sizeConfig = sizes[size];

        if (screenWidth < 768) {
            return sizeConfig.mobile;
        } else if (screenWidth < 1024) {
            return sizeConfig.tablet;
        } else {
            return sizeConfig.desktop;
        }
    };

    // Get touch target size
    const touchTargetSize = getTouchTargetSize(
        { size: touchSize, feedback: true, haptic: hapticFeedback },
        isMobile,
        isTablet
    );

    // Build className
    const buttonClasses = [
        // Base styles
        'inline-flex items-center justify-center font-semibold rounded-xl transition-all duration-200',
        'focus:outline-none focus:ring-4 focus:ring-opacity-50',
        'disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none',

        // Variant styles
        getVariantStyles(),

        // Size styles
        getSizeStyles(),

        // Width styles
        fullWidth ? 'w-full' : '',

        // Mobile-specific styles
        isMobile ? 'select-none -webkit-tap-highlight-color-transparent' : '',

        // Loading styles
        loading ? 'cursor-wait' : '',

        // Custom className
        className
    ].filter(Boolean).join(' ');

    // Focus ring color based on variant
    const getFocusRingColor = () => {
        switch (variant) {
            case 'primary': return 'focus:ring-emerald-500';
            case 'secondary': return 'focus:ring-slate-500';
            case 'outline': return 'focus:ring-emerald-500';
            case 'ghost': return 'focus:ring-slate-500';
            case 'danger': return 'focus:ring-red-500';
            default: return 'focus:ring-emerald-500';
        }
    };

    return (
        <button
            ref={combinedRef}
            className={`${buttonClasses} ${getFocusRingColor()}`}
            style={{
                minHeight: touchTargetSize,
                minWidth: touchTargetSize,
                ...(!fullWidth && { minWidth: touchTargetSize })
            }}
            disabled={disabled || loading}
            onClick={handleClick}
            {...getTouchProps(handleClick)}
            {...props}
            aria-label={props['aria-label'] || (typeof children === 'string' ? children : undefined)}
            role="button"
            tabIndex={disabled ? -1 : 0}
        >
            {/* Loading spinner */}
            {loading && (
                <div className="mr-2 animate-spin">
                    <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full"></div>
                </div>
            )}

            {/* Left icon */}
            {icon && iconPosition === 'left' && !loading && (
                <i className={`${icon} ${children ? 'mr-2' : ''}`} aria-hidden="true"></i>
            )}

            {/* Button content */}
            {children && (
                <span className={loading ? 'opacity-75' : ''}>
                    {children}
                </span>
            )}

            {/* Right icon */}
            {icon && iconPosition === 'right' && !loading && (
                <i className={`${icon} ${children ? 'ml-2' : ''}`} aria-hidden="true"></i>
            )}
        </button>
    );
});

MobileButton.displayName = 'MobileButton';

export default MobileButton;