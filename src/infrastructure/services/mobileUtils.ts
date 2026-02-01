/**
 * Mobile Utilities
 * Consolidated mobile-specific operations and helpers
 */

export interface ViewportDimensions {
    width: number;
    height: number;
    availableWidth: number;
    availableHeight: number;
}

export interface TouchEvent {
    clientX: number;
    clientY: number;
    target: EventTarget | null;
}

export interface ValidationRules {
    required?: boolean;
    numeric?: boolean;
    min?: number;
    max?: number;
    pattern?: RegExp;
    custom?: (value: string) => string | null;
}

export interface ValidationResult {
    isValid: boolean;
    errors: string[];
    warnings: string[];
}

/**
 * Get current viewport dimensions with mobile-specific considerations
 */
export const getViewportDimensions = (): ViewportDimensions => {
    if (typeof window === 'undefined') {
        return {
            width: 1024,
            height: 768,
            availableWidth: 1024,
            availableHeight: 768,
        };
    }

    return {
        width: window.innerWidth,
        height: window.innerHeight,
        availableWidth: window.screen.availWidth,
        availableHeight: window.screen.availHeight,
    };
};

/**
 * Check if device is in landscape orientation
 */
export const isLandscape = (): boolean => {
    if (typeof window === 'undefined') return false;

    // Use orientation API if available
    if (screen.orientation) {
        return screen.orientation.angle === 90 || screen.orientation.angle === -90;
    }

    // Fallback to window dimensions
    return window.innerWidth > window.innerHeight;
};

/**
 * Check if device is in portrait orientation
 */
export const isPortrait = (): boolean => {
    return !isLandscape();
};

/**
 * Get safe area insets for devices with notches/rounded corners
 */
export const getSafeAreaInsets = () => {
    if (typeof window === 'undefined' || !CSS.supports('padding-top: env(safe-area-inset-top)')) {
        return {
            top: 0,
            right: 0,
            bottom: 0,
            left: 0,
        };
    }

    const computedStyle = getComputedStyle(document.documentElement);

    return {
        top: parseInt(computedStyle.getPropertyValue('env(safe-area-inset-top)')) || 0,
        right: parseInt(computedStyle.getPropertyValue('env(safe-area-inset-right)')) || 0,
        bottom: parseInt(computedStyle.getPropertyValue('env(safe-area-inset-bottom)')) || 0,
        left: parseInt(computedStyle.getPropertyValue('env(safe-area-inset-left)')) || 0,
    };
};

/**
 * Debounce function for performance optimization on mobile
 */
export const debounce = <T extends (...args: any[]) => any>(
    func: T,
    wait: number,
    immediate = false
): ((...args: Parameters<T>) => void) => {
    let timeout: NodeJS.Timeout | null = null;

    return (...args: Parameters<T>) => {
        const later = () => {
            timeout = null;
            if (!immediate) func(...args);
        };

        const callNow = immediate && !timeout;

        if (timeout) clearTimeout(timeout);
        timeout = setTimeout(later, wait);

        if (callNow) func(...args);
    };
};

/**
 * Throttle function for scroll and resize events on mobile
 */
export const throttle = <T extends (...args: any[]) => any>(
    func: T,
    limit: number
): ((...args: Parameters<T>) => void) => {
    let inThrottle: boolean;

    return (...args: Parameters<T>) => {
        if (!inThrottle) {
            func(...args);
            inThrottle = true;
            setTimeout(() => inThrottle = false, limit);
        }
    };
};

/**
 * Check if element is in viewport (mobile-optimized)
 */
export const isElementInViewport = (element: Element): boolean => {
    if (typeof window === 'undefined') return false;

    const rect = element.getBoundingClientRect();
    const viewport = getViewportDimensions();

    return (
        rect.top >= 0 &&
        rect.left >= 0 &&
        rect.bottom <= viewport.height &&
        rect.right <= viewport.width
    );
};

/**
 * Smooth scroll to element with mobile optimization
 */
export const scrollToElement = (
    element: Element | string,
    options: {
        behavior?: 'smooth' | 'auto';
        block?: 'start' | 'center' | 'end' | 'nearest';
        inline?: 'start' | 'center' | 'end' | 'nearest';
        offset?: number;
    } = {}
) => {
    if (typeof window === 'undefined') return;

    const targetElement = typeof element === 'string'
        ? document.querySelector(element)
        : element;

    if (!targetElement) return;

    const {
        behavior = 'smooth',
        block = 'start',
        inline = 'nearest',
        offset = 0
    } = options;

    // Calculate position with offset
    const elementRect = targetElement.getBoundingClientRect();
    const absoluteElementTop = elementRect.top + window.pageYOffset;
    const middle = absoluteElementTop - offset;

    window.scrollTo({
        top: middle,
        behavior,
    });
};

/**
 * Get touch coordinates from touch event
 */
export const getTouchCoordinates = (event: any): TouchEvent => {
    const touch = event.touches?.[0] || event.changedTouches?.[0] || event;

    return {
        clientX: touch.clientX || 0,
        clientY: touch.clientY || 0,
        target: touch.target || null,
    };
};

/**
 * Calculate distance between two touch points
 */
export const getTouchDistance = (touch1: TouchEvent, touch2: TouchEvent): number => {
    const dx = touch1.clientX - touch2.clientX;
    const dy = touch1.clientY - touch2.clientY;
    return Math.sqrt(dx * dx + dy * dy);
};

/**
 * Detect swipe direction from touch events
 */
export const getSwipeDirection = (
    startTouch: TouchEvent,
    endTouch: TouchEvent,
    minDistance = 50
): 'left' | 'right' | 'up' | 'down' | null => {
    const dx = endTouch.clientX - startTouch.clientX;
    const dy = endTouch.clientY - startTouch.clientY;

    const absDx = Math.abs(dx);
    const absDy = Math.abs(dy);

    // Check if swipe distance is sufficient
    if (Math.max(absDx, absDy) < minDistance) {
        return null;
    }

    // Determine primary direction
    if (absDx > absDy) {
        return dx > 0 ? 'right' : 'left';
    } else {
        return dy > 0 ? 'down' : 'up';
    }
};

/**
 * Enhanced input validation with mobile-specific rules
 */
export const validateMobileInput = (
    value: string,
    rules: ValidationRules,
    fieldType: 'text' | 'number' | 'email' | 'tel' | 'url' = 'text'
): ValidationResult => {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Required validation
    if (rules.required && !value.trim()) {
        errors.push('This field is required');
    }

    if (value.trim()) {
        // Numeric validation
        if (rules.numeric || fieldType === 'number') {
            const numValue = Number(value);
            if (isNaN(numValue)) {
                errors.push('Must be a valid number');
            } else {
                // Min/max validation for numbers
                if (rules.min !== undefined && numValue < rules.min) {
                    errors.push(`Must be at least ${rules.min}`);
                }
                if (rules.max !== undefined && numValue > rules.max) {
                    errors.push(`Must not exceed ${rules.max}`);
                }
            }
        }

        // Pattern validation
        if (rules.pattern && !rules.pattern.test(value)) {
            errors.push('Invalid format');
        }

        // Field type specific validation
        switch (fieldType) {
            case 'email':
                const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
                if (!emailPattern.test(value)) {
                    errors.push('Invalid email address');
                }
                break;
            case 'tel':
                const phonePattern = /^[\+]?[1-9][\d]{0,15}$/;
                if (!phonePattern.test(value.replace(/[\s\-\(\)]/g, ''))) {
                    errors.push('Invalid phone number');
                }
                break;
            case 'url':
                try {
                    new URL(value);
                } catch {
                    errors.push('Invalid URL');
                }
                break;
        }

        // Custom validation
        if (rules.custom) {
            const customError = rules.custom(value);
            if (customError) {
                errors.push(customError);
            }
        }

        // Mobile-specific warnings
        if (fieldType === 'number' && value.length > 10) {
            warnings.push('Very long number - please verify');
        }

        if (fieldType === 'text' && value.length > 100) {
            warnings.push('Long text - consider shortening for mobile');
        }
    }

    return {
        isValid: errors.length === 0,
        errors,
        warnings,
    };
};

/**
 * Mobile-friendly clipboard operations
 */
export const copyToClipboard = async (text: string): Promise<boolean> => {
    if (typeof navigator === 'undefined') return false;

    try {
        if (navigator.clipboard && window.isSecureContext) {
            await navigator.clipboard.writeText(text);
            return true;
        } else {
            // Fallback for older browsers
            const textArea = document.createElement('textarea');
            textArea.value = text;
            textArea.style.position = 'fixed';
            textArea.style.left = '-999999px';
            textArea.style.top = '-999999px';
            document.body.appendChild(textArea);
            textArea.focus();
            textArea.select();

            const result = document.execCommand('copy');
            document.body.removeChild(textArea);
            return result;
        }
    } catch (error) {
        console.error('Failed to copy to clipboard:', error);
        return false;
    }
};

/**
 * Prevent iOS zoom on input focus
 */
export const preventIOSZoom = (input: HTMLInputElement): void => {
    if (input && /iPad|iPhone|iPod/.test(navigator.userAgent)) {
        input.style.fontSize = '16px';
    }
};
export const mobileStorage = {
    set: (key: string, value: any): boolean => {
        try {
            const serialized = JSON.stringify(value);

            // Check if storage is approaching limits (mobile devices have smaller limits)
            const estimatedSize = new Blob([serialized]).size;
            if (estimatedSize > 1024 * 1024) { // 1MB limit for mobile
                console.warn('Data size too large for mobile storage');
                return false;
            }

            localStorage.setItem(key, serialized);
            return true;
        } catch (error) {
            console.error('Mobile storage set failed:', error);
            return false;
        }
    },

    get: <T>(key: string, defaultValue?: T): T | null => {
        try {
            const item = localStorage.getItem(key);
            return item ? JSON.parse(item) : defaultValue || null;
        } catch (error) {
            console.error('Mobile storage get failed:', error);
            return defaultValue || null;
        }
    },

    remove: (key: string): boolean => {
        try {
            localStorage.removeItem(key);
            return true;
        } catch (error) {
            console.error('Mobile storage remove failed:', error);
            return false;
        }
    },

    clear: (): boolean => {
        try {
            localStorage.clear();
            return true;
        } catch (error) {
            console.error('Mobile storage clear failed:', error);
            return false;
        }
    },

    getUsage: (): { used: number; available: number } => {
        let used = 0;

        try {
            for (let key in localStorage) {
                if (localStorage.hasOwnProperty(key)) {
                    used += localStorage[key].length + key.length;
                }
            }
        } catch (error) {
            console.error('Failed to calculate storage usage:', error);
        }

        // Estimate available space (mobile browsers typically have 5-10MB)
        const estimated = 5 * 1024 * 1024; // 5MB estimate

        return {
            used,
            available: Math.max(0, estimated - used),
        };
    },
};