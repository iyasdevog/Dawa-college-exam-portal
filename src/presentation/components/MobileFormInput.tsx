import React, { forwardRef, useState, useRef, useEffect } from 'react';
import { useMobile } from '../hooks/useMobile';
import { getMobileInputProps, getTouchTargetSize } from '../utils/mobileOptimization';

interface MobileFormInputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'size'> {
    label?: string;
    error?: string;
    hint?: string;
    leftIcon?: string;
    rightIcon?: string;
    onRightIconClick?: () => void;
    size?: 'sm' | 'md' | 'lg';
    variant?: 'default' | 'filled' | 'outline';
    touchOptimized?: boolean;
    showValidation?: boolean;
    validationState?: 'valid' | 'invalid' | 'pending';
}

/**
 * Mobile-First Form Input Component
 * Implements Requirements 8.4 - Form optimization with appropriate input types and validation
 * Ensures proper touch targets and mobile-friendly input behavior
 */
export const MobileFormInput = forwardRef<HTMLInputElement, MobileFormInputProps>(({
    label,
    error,
    hint,
    leftIcon,
    rightIcon,
    onRightIconClick,
    size = 'md',
    variant = 'default',
    touchOptimized = true,
    showValidation = true,
    validationState,
    className = '',
    type = 'text',
    disabled,
    required,
    id,
    ...props
}, ref) => {
    const { isMobile, isTablet, screenWidth } = useMobile();
    const [isFocused, setIsFocused] = useState(false);
    const [hasValue, setHasValue] = useState(false);
    const inputRef = useRef<HTMLInputElement>(null);

    // Combine refs
    const combinedRef = (node: HTMLInputElement) => {
        inputRef.current = node;
        if (typeof ref === 'function') {
            ref(node);
        } else if (ref) {
            ref.current = node;
        }
    };

    // Generate unique ID if not provided
    const inputId = id || `mobile-input-${Math.random().toString(36).substr(2, 9)}`;

    // Update hasValue state
    useEffect(() => {
        const input = inputRef.current;
        if (input) {
            setHasValue(!!input.value);
        }
    }, [props.value, props.defaultValue]);

    // Handle focus events
    const handleFocus = (e: React.FocusEvent<HTMLInputElement>) => {
        setIsFocused(true);
        if (props.onFocus) {
            props.onFocus(e);
        }
    };

    const handleBlur = (e: React.FocusEvent<HTMLInputElement>) => {
        setIsFocused(false);
        setHasValue(!!e.target.value);
        if (props.onBlur) {
            props.onBlur(e);
        }
    };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setHasValue(!!e.target.value);
        if (props.onChange) {
            props.onChange(e);
        }
    };

    // Get mobile-optimized input props
    const mobileProps = touchOptimized ? getMobileInputProps(
        type as 'text' | 'number' | 'email' | 'tel' | 'search',
        isMobile
    ) : {};

    // Get size styles
    const getSizeStyles = () => {
        const sizes = {
            sm: {
                mobile: 'px-3 py-2 text-sm',
                tablet: 'px-4 py-2 text-sm',
                desktop: 'px-4 py-2 text-sm'
            },
            md: {
                mobile: 'px-4 py-3 text-base',
                tablet: 'px-4 py-3 text-base',
                desktop: 'px-4 py-3 text-base'
            },
            lg: {
                mobile: 'px-6 py-4 text-lg',
                tablet: 'px-6 py-4 text-lg',
                desktop: 'px-6 py-4 text-lg'
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

    // Get variant styles
    const getVariantStyles = () => {
        const variants = {
            default: 'border border-slate-300 bg-white focus:border-emerald-500 focus:ring-emerald-500',
            filled: 'border-0 bg-slate-100 focus:bg-white focus:ring-emerald-500',
            outline: 'border-2 border-slate-300 bg-transparent focus:border-emerald-500 focus:ring-emerald-500'
        };
        return variants[variant];
    };

    // Get validation styles
    const getValidationStyles = () => {
        if (!showValidation) return '';

        if (error) {
            return 'border-red-500 focus:border-red-500 focus:ring-red-500';
        }

        if (validationState === 'valid') {
            return 'border-green-500 focus:border-green-500 focus:ring-green-500';
        }

        if (validationState === 'invalid') {
            return 'border-red-500 focus:border-red-500 focus:ring-red-500';
        }

        return '';
    };

    // Get touch target size
    const touchTargetSize = getTouchTargetSize(
        { size: 'comfortable', feedback: true },
        isMobile,
        isTablet
    );

    // Build input classes
    const inputClasses = [
        // Base styles
        'w-full rounded-xl transition-all duration-200',
        'focus:outline-none focus:ring-4 focus:ring-opacity-20',
        'disabled:opacity-50 disabled:cursor-not-allowed',
        'placeholder:text-slate-400',

        // Size styles
        getSizeStyles(),

        // Variant styles
        getVariantStyles(),

        // Validation styles
        getValidationStyles(),

        // Icon padding adjustments
        leftIcon ? 'pl-12' : '',
        rightIcon ? 'pr-12' : '',

        // Mobile-specific styles
        isMobile ? 'select-none' : '',

        // Custom className
        className
    ].filter(Boolean).join(' ');

    return (
        <div className="w-full">
            {/* Label */}
            {label && (
                <label
                    htmlFor={inputId}
                    className={`
            block text-sm font-semibold mb-2 transition-colors duration-200
            ${error ? 'text-red-600' : 'text-slate-700'}
            ${required ? "after:content-['*'] after:text-red-500 after:ml-1" : ''}
          `}
                >
                    {label}
                </label>
            )}

            {/* Input container */}
            <div className="relative">
                {/* Left icon */}
                {leftIcon && (
                    <div className="absolute left-4 top-1/2 transform -translate-y-1/2 text-slate-400 pointer-events-none">
                        <i className={`${leftIcon} text-lg`} aria-hidden="true"></i>
                    </div>
                )}

                {/* Input field */}
                <input
                    ref={combinedRef}
                    id={inputId}
                    type={type}
                    className={inputClasses}
                    style={{
                        minHeight: touchOptimized ? touchTargetSize : undefined,
                        // Prevent zoom on iOS
                        fontSize: isMobile && touchOptimized ? '16px' : undefined
                    }}
                    disabled={disabled}
                    required={required}
                    onFocus={handleFocus}
                    onBlur={handleBlur}
                    onChange={handleChange}
                    {...mobileProps}
                    {...props}
                    aria-invalid={error ? 'true' : 'false'}
                    aria-describedby={
                        [
                            error ? `${inputId}-error` : '',
                            hint ? `${inputId}-hint` : '',
                            validationState ? `${inputId}-validation` : ''
                        ].filter(Boolean).join(' ') || undefined
                    }
                />

                {/* Right icon */}
                {rightIcon && (
                    <button
                        type="button"
                        className={`
              absolute right-4 top-1/2 transform -translate-y-1/2 text-slate-400
              hover:text-slate-600 transition-colors duration-200
              ${onRightIconClick ? 'cursor-pointer' : 'pointer-events-none'}
            `}
                        onClick={onRightIconClick}
                        tabIndex={onRightIconClick ? 0 : -1}
                        aria-label={onRightIconClick ? 'Click to perform action' : undefined}
                        style={{
                            minHeight: touchOptimized ? '44px' : undefined,
                            minWidth: touchOptimized ? '44px' : undefined
                        }}
                    >
                        <i className={`${rightIcon} text-lg`} aria-hidden="true"></i>
                    </button>
                )}

                {/* Validation indicator */}
                {showValidation && validationState && (
                    <div className="absolute right-4 top-1/2 transform -translate-y-1/2">
                        {validationState === 'valid' && (
                            <i className="fa-solid fa-check-circle text-green-500" aria-hidden="true"></i>
                        )}
                        {validationState === 'invalid' && (
                            <i className="fa-solid fa-exclamation-circle text-red-500" aria-hidden="true"></i>
                        )}
                        {validationState === 'pending' && (
                            <div className="animate-spin">
                                <i className="fa-solid fa-spinner text-slate-400" aria-hidden="true"></i>
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* Hint text */}
            {hint && !error && (
                <p
                    id={`${inputId}-hint`}
                    className="mt-2 text-sm text-slate-500"
                    role="note"
                >
                    {hint}
                </p>
            )}

            {/* Error message */}
            {error && (
                <p
                    id={`${inputId}-error`}
                    className="mt-2 text-sm text-red-600 flex items-center"
                    role="alert"
                    aria-live="polite"
                >
                    <i className="fa-solid fa-exclamation-triangle mr-2" aria-hidden="true"></i>
                    {error}
                </p>
            )}

            {/* Validation message */}
            {showValidation && validationState && (
                <div id={`${inputId}-validation`} className="sr-only" aria-live="polite">
                    {validationState === 'valid' && 'Input is valid'}
                    {validationState === 'invalid' && 'Input is invalid'}
                    {validationState === 'pending' && 'Validating input'}
                </div>
            )}
        </div>
    );
});

MobileFormInput.displayName = 'MobileFormInput';

export default MobileFormInput;