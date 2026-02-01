/**
 * Accessibility Utilities for WCAG 2.1 AA Compliance
 * Implements Requirements 8.5 - Accessibility compliance with ARIA labels, semantic HTML, and keyboard navigation
 */

export interface AccessibilityConfig {
    announceChanges: boolean;
    keyboardNavigation: boolean;
    screenReaderSupport: boolean;
    highContrast: boolean;
    reducedMotion: boolean;
}

export interface AriaAttributes {
    'aria-label'?: string;
    'aria-labelledby'?: string;
    'aria-describedby'?: string;
    'aria-expanded'?: boolean;
    'aria-hidden'?: boolean;
    'aria-live'?: 'off' | 'polite' | 'assertive';
    'aria-current'?: boolean | 'page' | 'step' | 'location' | 'date' | 'time';
    'aria-selected'?: boolean;
    'aria-checked'?: boolean;
    'aria-disabled'?: boolean;
    'aria-invalid'?: boolean | 'grammar' | 'spelling';
    'aria-required'?: boolean;
    'aria-readonly'?: boolean;
    'aria-multiline'?: boolean;
    'aria-autocomplete'?: 'none' | 'inline' | 'list' | 'both';
    'aria-haspopup'?: boolean | 'menu' | 'listbox' | 'tree' | 'grid' | 'dialog';
    'aria-controls'?: string;
    'aria-owns'?: string;
    'aria-activedescendant'?: string;
    'aria-setsize'?: number;
    'aria-posinset'?: number;
    'aria-level'?: number;
    'aria-valuemin'?: number;
    'aria-valuemax'?: number;
    'aria-valuenow'?: number;
    'aria-valuetext'?: string;
    role?: string;
}

/**
 * Screen Reader Announcer
 * Provides live region announcements for screen readers
 */
class ScreenReaderAnnouncer {
    private liveRegion: HTMLElement | null = null;
    private politeRegion: HTMLElement | null = null;
    private assertiveRegion: HTMLElement | null = null;

    constructor() {
        this.createLiveRegions();
    }

    private createLiveRegions() {
        // Create polite live region
        this.politeRegion = document.createElement('div');
        this.politeRegion.setAttribute('aria-live', 'polite');
        this.politeRegion.setAttribute('aria-atomic', 'true');
        this.politeRegion.className = 'sr-only';
        this.politeRegion.id = 'polite-announcer';
        document.body.appendChild(this.politeRegion);

        // Create assertive live region
        this.assertiveRegion = document.createElement('div');
        this.assertiveRegion.setAttribute('aria-live', 'assertive');
        this.assertiveRegion.setAttribute('aria-atomic', 'true');
        this.assertiveRegion.className = 'sr-only';
        this.assertiveRegion.id = 'assertive-announcer';
        document.body.appendChild(this.assertiveRegion);
    }

    announce(message: string, priority: 'polite' | 'assertive' = 'polite') {
        const region = priority === 'assertive' ? this.assertiveRegion : this.politeRegion;

        if (region) {
            // Clear previous message
            region.textContent = '';

            // Add new message after a brief delay to ensure screen readers pick it up
            setTimeout(() => {
                region.textContent = message;
            }, 100);

            // Clear message after announcement
            setTimeout(() => {
                region.textContent = '';
            }, 1000);
        }
    }

    announceNavigation(pageName: string, pageDescription?: string) {
        const message = pageDescription
            ? `Navigated to ${pageName}. ${pageDescription}`
            : `Navigated to ${pageName}`;
        this.announce(message, 'polite');
    }

    announceError(error: string) {
        this.announce(`Error: ${error}`, 'assertive');
    }

    announceSuccess(message: string) {
        this.announce(`Success: ${message}`, 'polite');
    }

    announceLoading(isLoading: boolean, context?: string) {
        if (isLoading) {
            const message = context ? `Loading ${context}` : 'Loading';
            this.announce(message, 'polite');
        } else {
            const message = context ? `${context} loaded` : 'Loading complete';
            this.announce(message, 'polite');
        }
    }

    cleanup() {
        if (this.politeRegion) {
            document.body.removeChild(this.politeRegion);
        }
        if (this.assertiveRegion) {
            document.body.removeChild(this.assertiveRegion);
        }
    }
}

// Global announcer instance
export const screenReaderAnnouncer = new ScreenReaderAnnouncer();

/**
 * Keyboard Navigation Manager
 * Handles keyboard navigation patterns and focus management
 */
export class KeyboardNavigationManager {
    private focusableElements: string[] = [
        'a[href]',
        'button:not([disabled])',
        'input:not([disabled])',
        'select:not([disabled])',
        'textarea:not([disabled])',
        '[tabindex]:not([tabindex="-1"])',
        '[contenteditable="true"]'
    ];

    private trapFocus: boolean = false;
    private focusTrapContainer: HTMLElement | null = null;

    getFocusableElements(container: HTMLElement = document.body): HTMLElement[] {
        const selector = this.focusableElements.join(', ');
        return Array.from(container.querySelectorAll(selector)) as HTMLElement[];
    }

    getFirstFocusableElement(container: HTMLElement = document.body): HTMLElement | null {
        const focusableElements = this.getFocusableElements(container);
        return focusableElements[0] || null;
    }

    getLastFocusableElement(container: HTMLElement = document.body): HTMLElement | null {
        const focusableElements = this.getFocusableElements(container);
        return focusableElements[focusableElements.length - 1] || null;
    }

    focusFirst(container: HTMLElement = document.body): boolean {
        const firstElement = this.getFirstFocusableElement(container);
        if (firstElement) {
            firstElement.focus();
            return true;
        }
        return false;
    }

    focusLast(container: HTMLElement = document.body): boolean {
        const lastElement = this.getLastFocusableElement(container);
        if (lastElement) {
            lastElement.focus();
            return true;
        }
        return false;
    }

    enableFocusTrap(container: HTMLElement) {
        this.trapFocus = true;
        this.focusTrapContainer = container;

        const handleKeyDown = (e: KeyboardEvent) => {
            if (!this.trapFocus || !this.focusTrapContainer) return;

            if (e.key === 'Tab') {
                const focusableElements = this.getFocusableElements(this.focusTrapContainer);
                const firstElement = focusableElements[0];
                const lastElement = focusableElements[focusableElements.length - 1];

                if (e.shiftKey) {
                    // Shift + Tab
                    if (document.activeElement === firstElement) {
                        e.preventDefault();
                        lastElement?.focus();
                    }
                } else {
                    // Tab
                    if (document.activeElement === lastElement) {
                        e.preventDefault();
                        firstElement?.focus();
                    }
                }
            }

            if (e.key === 'Escape') {
                this.disableFocusTrap();
            }
        };

        document.addEventListener('keydown', handleKeyDown);

        // Focus first element
        this.focusFirst(container);

        return () => {
            document.removeEventListener('keydown', handleKeyDown);
            this.disableFocusTrap();
        };
    }

    disableFocusTrap() {
        this.trapFocus = false;
        this.focusTrapContainer = null;
    }

    createSkipLink(targetId: string, text: string = 'Skip to main content'): HTMLElement {
        const skipLink = document.createElement('a');
        skipLink.href = `#${targetId}`;
        skipLink.textContent = text;
        skipLink.className = 'sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-50 focus:px-4 focus:py-2 focus:bg-blue-600 focus:text-white focus:rounded-md';

        skipLink.addEventListener('click', (e) => {
            e.preventDefault();
            const target = document.getElementById(targetId);
            if (target) {
                target.focus();
                target.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }
        });

        return skipLink;
    }
}

// Global keyboard navigation manager
export const keyboardNavigation = new KeyboardNavigationManager();

/**
 * Color Contrast Utilities
 * Ensures WCAG AA color contrast compliance
 */
export const colorContrast = {
    // Calculate relative luminance
    getLuminance(r: number, g: number, b: number): number {
        const [rs, gs, bs] = [r, g, b].map(c => {
            c = c / 255;
            return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
        });
        return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
    },

    // Calculate contrast ratio between two colors
    getContrastRatio(color1: [number, number, number], color2: [number, number, number]): number {
        const lum1 = this.getLuminance(...color1);
        const lum2 = this.getLuminance(...color2);
        const brightest = Math.max(lum1, lum2);
        const darkest = Math.min(lum1, lum2);
        return (brightest + 0.05) / (darkest + 0.05);
    },

    // Check if contrast meets WCAG AA standards
    meetsWCAGAA(color1: [number, number, number], color2: [number, number, number], isLargeText: boolean = false): boolean {
        const ratio = this.getContrastRatio(color1, color2);
        return isLargeText ? ratio >= 3 : ratio >= 4.5;
    },

    // Check if contrast meets WCAG AAA standards
    meetsWCAGAAA(color1: [number, number, number], color2: [number, number, number], isLargeText: boolean = false): boolean {
        const ratio = this.getContrastRatio(color1, color2);
        return isLargeText ? ratio >= 4.5 : ratio >= 7;
    },

    // Convert hex to RGB
    hexToRgb(hex: string): [number, number, number] | null {
        const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
        return result ? [
            parseInt(result[1], 16),
            parseInt(result[2], 16),
            parseInt(result[3], 16)
        ] : null;
    }
};

/**
 * Accessibility Checker
 * Validates accessibility compliance of elements
 */
export const accessibilityChecker = {
    checkElement(element: HTMLElement): { passed: boolean; issues: string[] } {
        const issues: string[] = [];

        // Check for alt text on images
        if (element.tagName === 'IMG') {
            const img = element as HTMLImageElement;
            if (!img.alt && !img.getAttribute('aria-label')) {
                issues.push('Image missing alt text or aria-label');
            }
        }

        // Check for form labels
        if (['INPUT', 'SELECT', 'TEXTAREA'].includes(element.tagName)) {
            const input = element as HTMLInputElement;
            const hasLabel = input.labels && input.labels.length > 0;
            const hasAriaLabel = input.getAttribute('aria-label');
            const hasAriaLabelledBy = input.getAttribute('aria-labelledby');

            if (!hasLabel && !hasAriaLabel && !hasAriaLabelledBy) {
                issues.push('Form control missing label');
            }
        }

        // Check for button text
        if (element.tagName === 'BUTTON') {
            const button = element as HTMLButtonElement;
            const hasText = button.textContent?.trim();
            const hasAriaLabel = button.getAttribute('aria-label');

            if (!hasText && !hasAriaLabel) {
                issues.push('Button missing accessible text');
            }
        }

        // Check for link text
        if (element.tagName === 'A') {
            const link = element as HTMLAnchorElement;
            const hasText = link.textContent?.trim();
            const hasAriaLabel = link.getAttribute('aria-label');

            if (!hasText && !hasAriaLabel) {
                issues.push('Link missing accessible text');
            }
        }

        // Check for heading hierarchy
        if (/^H[1-6]$/.test(element.tagName)) {
            const level = parseInt(element.tagName.charAt(1));
            const prevHeading = this.findPreviousHeading(element);

            if (prevHeading && level > prevHeading + 1) {
                issues.push(`Heading level ${level} skips levels (previous was H${prevHeading})`);
            }
        }

        // Check for focus indicators
        const computedStyle = window.getComputedStyle(element, ':focus');
        if (element.tabIndex >= 0 && computedStyle.outline === 'none' && !computedStyle.boxShadow) {
            issues.push('Focusable element missing focus indicator');
        }

        return {
            passed: issues.length === 0,
            issues
        };
    },

    findPreviousHeading(element: HTMLElement): number | null {
        let current = element.previousElementSibling;

        while (current) {
            if (/^H[1-6]$/.test(current.tagName)) {
                return parseInt(current.tagName.charAt(1));
            }
            current = current.previousElementSibling;
        }

        return null;
    },

    checkPage(): { passed: boolean; issues: Array<{ element: HTMLElement; issues: string[] }> } {
        const allElements = document.querySelectorAll('*');
        const pageIssues: Array<{ element: HTMLElement; issues: string[] }> = [];

        allElements.forEach(element => {
            const result = this.checkElement(element as HTMLElement);
            if (!result.passed) {
                pageIssues.push({
                    element: element as HTMLElement,
                    issues: result.issues
                });
            }
        });

        return {
            passed: pageIssues.length === 0,
            issues: pageIssues
        };
    }
};

/**
 * Generate ARIA attributes for common patterns
 */
export const ariaHelpers = {
    button(label: string, expanded?: boolean, controls?: string): AriaAttributes {
        return {
            'aria-label': label,
            'aria-expanded': expanded,
            'aria-controls': controls,
            role: 'button'
        };
    },

    link(label: string, current?: boolean): AriaAttributes {
        return {
            'aria-label': label,
            'aria-current': current ? 'page' : undefined,
            role: 'link'
        };
    },

    textbox(label: string, required?: boolean, invalid?: boolean, describedBy?: string): AriaAttributes {
        return {
            'aria-label': label,
            'aria-required': required,
            'aria-invalid': invalid,
            'aria-describedby': describedBy,
            role: 'textbox'
        };
    },

    listbox(label: string, expanded?: boolean, activedescendant?: string): AriaAttributes {
        return {
            'aria-label': label,
            'aria-expanded': expanded,
            'aria-activedescendant': activedescendant,
            role: 'listbox'
        };
    },

    option(label: string, selected?: boolean, setsize?: number, posinset?: number): AriaAttributes {
        return {
            'aria-label': label,
            'aria-selected': selected,
            'aria-setsize': setsize,
            'aria-posinset': posinset,
            role: 'option'
        };
    },

    dialog(label: string, describedBy?: string): AriaAttributes {
        return {
            'aria-label': label,
            'aria-describedby': describedBy,
            'aria-modal': true,
            role: 'dialog'
        };
    },

    alert(label: string): AriaAttributes {
        return {
            'aria-label': label,
            'aria-live': 'assertive',
            role: 'alert'
        };
    },

    status(label: string): AriaAttributes {
        return {
            'aria-label': label,
            'aria-live': 'polite',
            role: 'status'
        };
    },

    progressbar(label: string, valuemin: number, valuemax: number, valuenow: number, valuetext?: string): AriaAttributes {
        return {
            'aria-label': label,
            'aria-valuemin': valuemin,
            'aria-valuemax': valuemax,
            'aria-valuenow': valuenow,
            'aria-valuetext': valuetext,
            role: 'progressbar'
        };
    }
};

/**
 * High contrast mode detection and utilities
 */
export const highContrast = {
    isEnabled(): boolean {
        return window.matchMedia('(prefers-contrast: high)').matches;
    },

    onToggle(callback: (enabled: boolean) => void): () => void {
        const mediaQuery = window.matchMedia('(prefers-contrast: high)');
        const handler = (e: MediaQueryListEvent) => callback(e.matches);

        mediaQuery.addEventListener('change', handler);

        return () => mediaQuery.removeEventListener('change', handler);
    },

    applyHighContrastStyles(element: HTMLElement) {
        if (this.isEnabled()) {
            element.classList.add('high-contrast');
        } else {
            element.classList.remove('high-contrast');
        }
    }
};

/**
 * Reduced motion detection and utilities
 */
export const reducedMotion = {
    isEnabled(): boolean {
        return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    },

    onToggle(callback: (enabled: boolean) => void): () => void {
        const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
        const handler = (e: MediaQueryListEvent) => callback(e.matches);

        mediaQuery.addEventListener('change', handler);

        return () => mediaQuery.removeEventListener('change', handler);
    },

    respectPreference<T>(normalValue: T, reducedValue: T): T {
        return this.isEnabled() ? reducedValue : normalValue;
    }
};

/**
 * Focus management utilities
 */
export const focusManagement = {
    saveFocus(): HTMLElement | null {
        return document.activeElement as HTMLElement;
    },

    restoreFocus(element: HTMLElement | null) {
        if (element && typeof element.focus === 'function') {
            element.focus();
        }
    },

    setFocusToFirstError(container: HTMLElement = document.body): boolean {
        const errorElement = container.querySelector('[aria-invalid="true"], .error, [data-error="true"]') as HTMLElement;
        if (errorElement) {
            errorElement.focus();
            return true;
        }
        return false;
    },

    announceAndFocus(element: HTMLElement, message: string) {
        screenReaderAnnouncer.announce(message);
        setTimeout(() => {
            element.focus();
        }, 100);
    }
};

/**
 * Initialize accessibility features
 */
export const initializeAccessibility = (config: Partial<AccessibilityConfig> = {}): (() => void) => {
    const fullConfig: AccessibilityConfig = {
        announceChanges: true,
        keyboardNavigation: true,
        screenReaderSupport: true,
        highContrast: true,
        reducedMotion: true,
        ...config
    };

    const cleanupFunctions: (() => void)[] = [];

    // Add skip links
    if (fullConfig.keyboardNavigation) {
        const mainContent = document.getElementById('main-content') || document.querySelector('main');
        if (mainContent) {
            const skipLink = keyboardNavigation.createSkipLink(mainContent.id || 'main-content');
            document.body.insertBefore(skipLink, document.body.firstChild);
        }
    }

    // Set up high contrast monitoring
    if (fullConfig.highContrast) {
        const cleanup = highContrast.onToggle((enabled) => {
            document.body.classList.toggle('high-contrast-mode', enabled);
        });
        cleanupFunctions.push(cleanup);
    }

    // Set up reduced motion monitoring
    if (fullConfig.reducedMotion) {
        const cleanup = reducedMotion.onToggle((enabled) => {
            document.body.classList.toggle('reduced-motion', enabled);
        });
        cleanupFunctions.push(cleanup);
    }

    // Return cleanup function
    return () => {
        cleanupFunctions.forEach(cleanup => cleanup());
        screenReaderAnnouncer.cleanup();
    };
};