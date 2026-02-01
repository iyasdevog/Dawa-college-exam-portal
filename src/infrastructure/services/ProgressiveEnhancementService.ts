/**
 * Progressive Enhancement Service
 * Provides utilities for progressive enhancement and graceful degradation
 * Following Clean Architecture - Infrastructure Layer
 */

import { browserCompatibility, BrowserFeatures } from './BrowserCompatibilityService';

export interface EnhancementConfig {
    baseClass: string;
    enhancedClass: string;
    requiredFeatures: (keyof BrowserFeatures)[];
    fallbackStrategy?: () => void;
}

export interface ComponentEnhancement {
    element: Element;
    config: EnhancementConfig;
    isEnhanced: boolean;
}

export class ProgressiveEnhancementService {
    private enhancements: Map<Element, ComponentEnhancement> = new Map();
    private observers: Map<string, MutationObserver> = new Map();

    constructor() {
        this.initializeEnhancement();
    }

    /**
     * Initialize progressive enhancement
     */
    private initializeEnhancement(): void {
        // Wait for DOM to be ready
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => this.setupEnhancement());
        } else {
            this.setupEnhancement();
        }
    }

    /**
     * Set up progressive enhancement
     */
    private setupEnhancement(): void {
        // Add JavaScript availability class
        document.documentElement.classList.remove('no-js');
        document.documentElement.classList.add('js');

        // Set up automatic enhancement detection
        this.setupAutoEnhancement();

        // Set up mutation observer for dynamic content
        this.setupMutationObserver();

        // Initialize common enhancements
        this.initializeCommonEnhancements();
    }

    /**
     * Set up automatic enhancement based on data attributes
     */
    private setupAutoEnhancement(): void {
        const enhanceableElements = document.querySelectorAll('[data-enhance]');

        enhanceableElements.forEach(element => {
            const enhanceConfig = element.getAttribute('data-enhance');
            if (enhanceConfig) {
                try {
                    const config = JSON.parse(enhanceConfig);
                    this.enhanceElement(element, config);
                } catch (error) {
                    console.warn('[PROGRESSIVE] Invalid enhancement config:', enhanceConfig, error);
                }
            }
        });
    }

    /**
     * Set up mutation observer for dynamic content
     */
    private setupMutationObserver(): void {
        if (!browserCompatibility.hasFeature('mutationObserver')) {
            // Fallback: periodic check for new elements
            setInterval(() => this.setupAutoEnhancement(), 1000);
            return;
        }

        const observer = new MutationObserver((mutations) => {
            mutations.forEach(mutation => {
                mutation.addedNodes.forEach(node => {
                    if (node.nodeType === Node.ELEMENT_NODE) {
                        const element = node as Element;

                        // Check if the added element needs enhancement
                        if (element.hasAttribute('data-enhance')) {
                            const enhanceConfig = element.getAttribute('data-enhance');
                            if (enhanceConfig) {
                                try {
                                    const config = JSON.parse(enhanceConfig);
                                    this.enhanceElement(element, config);
                                } catch (error) {
                                    console.warn('[PROGRESSIVE] Invalid enhancement config:', enhanceConfig, error);
                                }
                            }
                        }

                        // Check child elements
                        const childElements = element.querySelectorAll('[data-enhance]');
                        childElements.forEach(child => {
                            const childConfig = child.getAttribute('data-enhance');
                            if (childConfig) {
                                try {
                                    const config = JSON.parse(childConfig);
                                    this.enhanceElement(child, config);
                                } catch (error) {
                                    console.warn('[PROGRESSIVE] Invalid enhancement config:', childConfig, error);
                                }
                            }
                        });
                    }
                });
            });
        });

        observer.observe(document.body, {
            childList: true,
            subtree: true
        });

        this.observers.set('main', observer);
    }

    /**
     * Initialize common enhancements
     */
    private initializeCommonEnhancements(): void {
        // Grid enhancement
        this.enhanceGridLayouts();

        // Flexbox enhancement
        this.enhanceFlexLayouts();

        // Form enhancements
        this.enhanceForms();

        // Image enhancements
        this.enhanceImages();

        // Interactive enhancements
        this.enhanceInteractiveElements();
    }

    /**
     * Enhance an element with progressive enhancement
     */
    public enhanceElement(element: Element, config: EnhancementConfig): boolean {
        // Check if all required features are supported
        const isSupported = config.requiredFeatures.every(feature =>
            browserCompatibility.hasFeature(feature)
        );

        const enhancement: ComponentEnhancement = {
            element,
            config,
            isEnhanced: isSupported
        };

        if (isSupported) {
            // Apply enhanced class
            element.classList.remove(config.baseClass);
            element.classList.add(config.enhancedClass);

            // Add feature-specific classes
            config.requiredFeatures.forEach(feature => {
                element.classList.add(`enhanced-${feature}`);
            });
        } else {
            // Apply base class and fallback
            element.classList.remove(config.enhancedClass);
            element.classList.add(config.baseClass);

            // Apply fallback strategy if provided
            if (config.fallbackStrategy) {
                config.fallbackStrategy();
            }

            // Add fallback classes
            config.requiredFeatures.forEach(feature => {
                if (!browserCompatibility.hasFeature(feature)) {
                    element.classList.add(`fallback-${feature}`);
                }
            });
        }

        this.enhancements.set(element, enhancement);
        return isSupported;
    }

    /**
     * Enhance grid layouts
     */
    private enhanceGridLayouts(): void {
        const gridElements = document.querySelectorAll('.grid-container, [data-layout="grid"]');

        gridElements.forEach(element => {
            this.enhanceElement(element, {
                baseClass: 'grid-fallback',
                enhancedClass: 'grid-enhanced',
                requiredFeatures: ['cssGrid'],
                fallbackStrategy: () => {
                    // Apply flexbox fallback if available, otherwise use block layout
                    if (browserCompatibility.hasFeature('cssFlexbox')) {
                        element.classList.add('flex-fallback');
                    } else {
                        element.classList.add('block-fallback');
                    }
                }
            });
        });
    }

    /**
     * Enhance flexbox layouts
     */
    private enhanceFlexLayouts(): void {
        const flexElements = document.querySelectorAll('.flex-container, [data-layout="flex"]');

        flexElements.forEach(element => {
            this.enhanceElement(element, {
                baseClass: 'flex-fallback',
                enhancedClass: 'flex-enhanced',
                requiredFeatures: ['cssFlexbox'],
                fallbackStrategy: () => {
                    // Use block layout with float-based positioning
                    element.classList.add('block-fallback');
                }
            });
        });
    }

    /**
     * Enhance forms
     */
    private enhanceForms(): void {
        const forms = document.querySelectorAll('form[data-enhance-form]');

        forms.forEach(form => {
            // HTML5 form validation enhancement
            if ('checkValidity' in form) {
                form.classList.add('has-html5-validation');

                // Add custom validation styling
                const inputs = form.querySelectorAll('input, textarea, select');
                inputs.forEach(input => {
                    input.addEventListener('invalid', (e) => {
                        e.preventDefault();
                        input.classList.add('validation-error');
                    });

                    input.addEventListener('input', () => {
                        if (input.classList.contains('validation-error')) {
                            if ((input as HTMLInputElement).checkValidity()) {
                                input.classList.remove('validation-error');
                            }
                        }
                    });
                });
            } else {
                form.classList.add('no-html5-validation');
                // Implement basic JavaScript validation fallback
                this.implementBasicValidation(form);
            }
        });
    }

    /**
     * Enhance images
     */
    private enhanceImages(): void {
        const images = document.querySelectorAll('img[data-enhance-image]');

        images.forEach(img => {
            const imageElement = img as HTMLImageElement;

            // Lazy loading enhancement
            if ('loading' in imageElement) {
                imageElement.loading = 'lazy';
                imageElement.classList.add('has-native-lazy-loading');
            } else if (browserCompatibility.hasFeature('intersectionObserver')) {
                // Implement intersection observer lazy loading
                this.implementLazyLoading(imageElement);
                imageElement.classList.add('has-js-lazy-loading');
            } else {
                // No lazy loading support
                imageElement.classList.add('no-lazy-loading');
            }

            // WebP/AVIF support
            const features = browserCompatibility.getFeatures();
            if (features.avif) {
                imageElement.classList.add('supports-avif');
            } else if (features.webp) {
                imageElement.classList.add('supports-webp');
            } else {
                imageElement.classList.add('fallback-images');
            }
        });
    }

    /**
     * Enhance interactive elements
     */
    private enhanceInteractiveElements(): void {
        const interactiveElements = document.querySelectorAll('[data-enhance-interactive]');

        interactiveElements.forEach(element => {
            const features = browserCompatibility.getFeatures();

            // Touch optimization
            if (features.touchEvents) {
                element.classList.add('touch-optimized');

                // Add touch event handlers
                element.addEventListener('touchstart', () => {
                    element.classList.add('touch-active');
                }, { passive: true });

                element.addEventListener('touchend', () => {
                    element.classList.remove('touch-active');
                }, { passive: true });
            } else {
                element.classList.add('mouse-optimized');
            }

            // Pointer events
            if (features.pointerEvents) {
                element.classList.add('has-pointer-events');
            } else {
                element.classList.add('no-pointer-events');
            }
        });
    }

    /**
     * Implement basic form validation fallback
     */
    private implementBasicValidation(form: Element): void {
        const submitButton = form.querySelector('button[type="submit"], input[type="submit"]');

        if (submitButton) {
            submitButton.addEventListener('click', (e) => {
                const requiredFields = form.querySelectorAll('[required]');
                let isValid = true;

                requiredFields.forEach(field => {
                    const input = field as HTMLInputElement;
                    if (!input.value.trim()) {
                        input.classList.add('validation-error');
                        isValid = false;
                    } else {
                        input.classList.remove('validation-error');
                    }
                });

                if (!isValid) {
                    e.preventDefault();
                    // Focus first invalid field
                    const firstInvalid = form.querySelector('.validation-error') as HTMLElement;
                    if (firstInvalid) {
                        firstInvalid.focus();
                    }
                }
            });
        }
    }

    /**
     * Implement lazy loading with Intersection Observer
     */
    private implementLazyLoading(img: HTMLImageElement): void {
        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    const image = entry.target as HTMLImageElement;
                    const src = image.getAttribute('data-src');
                    if (src) {
                        image.src = src;
                        image.removeAttribute('data-src');
                        image.classList.add('loaded');
                    }
                    observer.unobserve(image);
                }
            });
        }, {
            rootMargin: '50px'
        });

        observer.observe(img);
    }

    /**
     * Get enhancement status for an element
     */
    public getEnhancementStatus(element: Element): ComponentEnhancement | null {
        return this.enhancements.get(element) || null;
    }

    /**
     * Re-evaluate enhancements (useful after feature detection changes)
     */
    public reevaluateEnhancements(): void {
        this.enhancements.forEach((enhancement, element) => {
            this.enhanceElement(element, enhancement.config);
        });
    }

    /**
     * Clean up observers and enhancements
     */
    public cleanup(): void {
        this.observers.forEach(observer => observer.disconnect());
        this.observers.clear();
        this.enhancements.clear();
    }

    /**
     * Add enhancement for specific component
     */
    public addComponentEnhancement(
        selector: string,
        config: EnhancementConfig
    ): void {
        const elements = document.querySelectorAll(selector);
        elements.forEach(element => {
            this.enhanceElement(element, config);
        });
    }

    /**
     * Check if a feature combination is supported
     */
    public isFeatureCombinationSupported(features: (keyof BrowserFeatures)[]): boolean {
        return features.every(feature => browserCompatibility.hasFeature(feature));
    }

    /**
     * Get fallback strategy for unsupported features
     */
    public getFallbackStrategy(
        unsupportedFeatures: (keyof BrowserFeatures)[]
    ): string[] {
        const fallbackClasses: string[] = [];

        unsupportedFeatures.forEach(feature => {
            switch (feature) {
                case 'cssGrid':
                    if (browserCompatibility.hasFeature('cssFlexbox')) {
                        fallbackClasses.push('flex-fallback');
                    } else {
                        fallbackClasses.push('block-fallback');
                    }
                    break;
                case 'cssFlexbox':
                    fallbackClasses.push('block-fallback');
                    break;
                case 'cssCustomProperties':
                    fallbackClasses.push('hardcoded-values');
                    break;
                case 'localStorage':
                    if (browserCompatibility.hasFeature('sessionStorage')) {
                        fallbackClasses.push('session-storage-fallback');
                    } else {
                        fallbackClasses.push('memory-storage-fallback');
                    }
                    break;
                default:
                    fallbackClasses.push(`no-${feature}`);
            }
        });

        return fallbackClasses;
    }
}

// Export singleton instance
export const progressiveEnhancement = new ProgressiveEnhancementService();