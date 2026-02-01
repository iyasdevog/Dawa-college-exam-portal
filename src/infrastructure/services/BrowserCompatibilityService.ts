/**
 * Browser Compatibility Service
 * Provides polyfills, feature detection, and progressive enhancement
 * Following Clean Architecture - Infrastructure Layer
 */

export interface BrowserFeatures {
    localStorage: boolean;
    sessionStorage: boolean;
    serviceWorker: boolean;
    intersectionObserver: boolean;
    resizeObserver: boolean;
    mutationObserver: boolean;
    fetch: boolean;
    promises: boolean;
    asyncAwait: boolean;
    cssGrid: boolean;
    cssFlexbox: boolean;
    cssCustomProperties: boolean;
    cssCalc: boolean;
    cssSupports: boolean;
    webp: boolean;
    avif: boolean;
    touchEvents: boolean;
    pointerEvents: boolean;
}

export interface PolyfillConfig {
    loadPolyfills: boolean;
    polyfillsToLoad: string[];
    fallbackStrategies: Record<string, () => void>;
}

export class BrowserCompatibilityService {
    private features: BrowserFeatures = {
        localStorage: false,
        sessionStorage: false,
        serviceWorker: false,
        intersectionObserver: false,
        resizeObserver: false,
        mutationObserver: false,
        fetch: false,
        promises: false,
        asyncAwait: false,
        cssGrid: false,
        cssFlexbox: false,
        cssCustomProperties: false,
        cssCalc: false,
        cssSupports: false,
        webp: false,
        avif: false,
        touchEvents: false,
        pointerEvents: false
    };
    private polyfillsLoaded: Set<string> = new Set();
    private fallbacksApplied: Set<string> = new Set();

    constructor() {
        this.initializeCompatibility();
    }

    /**
     * Initialize compatibility features
     */
    private async initializeCompatibility(): Promise<void> {
        this.features = await this.detectFeatures();

        // Update image format support asynchronously
        this.updateImageFormatSupport();

        this.setupCompatibility();
    }

    /**
     * Update image format support asynchronously
     */
    private async updateImageFormatSupport(): Promise<void> {
        try {
            const [webpSupported, avifSupported] = await Promise.all([
                this.hasImageFormat('webp'),
                this.hasImageFormat('avif')
            ]);

            this.features.webp = webpSupported;
            this.features.avif = avifSupported;

            // Update DOM classes
            document.documentElement.classList.add(webpSupported ? 'has-webp' : 'no-webp');
            document.documentElement.classList.add(avifSupported ? 'has-avif' : 'no-avif');
        } catch (error) {
            console.warn('[COMPATIBILITY] Error detecting image format support:', error);
        }
    }

    /**
     * Detect browser features and capabilities
     */
    private async detectFeatures(): Promise<BrowserFeatures> {
        return {
            // Storage APIs
            localStorage: this.hasLocalStorage(),
            sessionStorage: this.hasSessionStorage(),

            // Service Worker
            serviceWorker: 'serviceWorker' in navigator,

            // Observers
            intersectionObserver: 'IntersectionObserver' in window,
            resizeObserver: 'ResizeObserver' in window,
            mutationObserver: 'MutationObserver' in window,

            // JavaScript APIs
            fetch: 'fetch' in window,
            promises: 'Promise' in window,
            asyncAwait: this.hasAsyncAwait(),

            // CSS Features
            cssGrid: this.hasCSSFeature('display', 'grid'),
            cssFlexbox: this.hasCSSFeature('display', 'flex'),
            cssCustomProperties: this.hasCSSCustomProperties(),
            cssCalc: this.hasCSSFeature('width', 'calc(1px)'),
            cssSupports: 'CSS' in window && 'supports' in window.CSS,

            // Image formats
            webp: this.hasImageFormat('webp'),
            avif: this.hasImageFormat('avif'),

            // Input methods
            touchEvents: 'ontouchstart' in window,
            pointerEvents: 'onpointerdown' in window
        };
    }

    /**
     * Initialize compatibility features
     */
    private setupCompatibility(): void {
        // Load essential polyfills immediately
        this.loadEssentialPolyfills();

        // Apply CSS fallbacks
        this.applyCSSFallbacks();

        // Set up progressive enhancement
        this.setupProgressiveEnhancement();
    }

    /**
     * Load essential polyfills for core functionality
     */
    private async loadEssentialPolyfills(): Promise<void> {
        const polyfillsToLoad: Array<{ condition: boolean; name: string; loader: () => Promise<void> }> = [
            {
                condition: !this.features.promises,
                name: 'promises',
                loader: () => this.loadPromisePolyfill()
            },
            {
                condition: !this.features.fetch,
                name: 'fetch',
                loader: () => this.loadFetchPolyfill()
            },
            {
                condition: !this.features.intersectionObserver,
                name: 'intersection-observer',
                loader: () => this.loadIntersectionObserverPolyfill()
            },
            {
                condition: !this.features.resizeObserver,
                name: 'resize-observer',
                loader: () => this.loadResizeObserverPolyfill()
            }
        ];

        for (const polyfill of polyfillsToLoad) {
            if (polyfill.condition && !this.polyfillsLoaded.has(polyfill.name)) {
                try {
                    await polyfill.loader();
                    this.polyfillsLoaded.add(polyfill.name);
                    console.log(`[COMPATIBILITY] Loaded ${polyfill.name} polyfill`);
                } catch (error) {
                    console.warn(`[COMPATIBILITY] Failed to load ${polyfill.name} polyfill:`, error);
                }
            }
        }
    }

    /**
     * Apply CSS fallbacks for unsupported features
     */
    private applyCSSFallbacks(): void {
        const fallbacks = [
            {
                condition: !this.features.cssGrid,
                name: 'css-grid',
                apply: () => this.applyCSSGridFallback()
            },
            {
                condition: !this.features.cssFlexbox,
                name: 'css-flexbox',
                apply: () => this.applyCSSFlexboxFallback()
            },
            {
                condition: !this.features.cssCustomProperties,
                name: 'css-custom-properties',
                apply: () => this.applyCSSCustomPropertiesFallback()
            }
        ];

        fallbacks.forEach(fallback => {
            if (fallback.condition && !this.fallbacksApplied.has(fallback.name)) {
                try {
                    fallback.apply();
                    this.fallbacksApplied.add(fallback.name);
                    console.log(`[COMPATIBILITY] Applied ${fallback.name} fallback`);
                } catch (error) {
                    console.warn(`[COMPATIBILITY] Failed to apply ${fallback.name} fallback:`, error);
                }
            }
        });
    }

    /**
     * Set up progressive enhancement
     */
    private setupProgressiveEnhancement(): void {
        // Add feature classes to document
        this.addFeatureClasses();

        // Set up touch/pointer event handling
        this.setupInputMethodDetection();
    }

    // Feature Detection Methods
    private hasLocalStorage(): boolean {
        try {
            const test = '__localStorage_test__';
            localStorage.setItem(test, test);
            localStorage.removeItem(test);
            return true;
        } catch {
            return false;
        }
    }

    private hasSessionStorage(): boolean {
        try {
            const test = '__sessionStorage_test__';
            sessionStorage.setItem(test, test);
            sessionStorage.removeItem(test);
            return true;
        } catch {
            return false;
        }
    }

    private hasAsyncAwait(): boolean {
        try {
            // Check if async/await syntax is supported
            const AsyncFunction = (async () => { }).constructor;
            return typeof AsyncFunction === 'function';
        } catch {
            return false;
        }
    }

    private hasCSSFeature(property: string, value: string): boolean {
        if (!this.features.cssSupports) {
            // Fallback feature detection without CSS.supports
            const element = document.createElement('div');
            try {
                (element.style as any)[property] = value;
                return (element.style as any)[property] === value;
            } catch {
                return false;
            }
        }
        return CSS.supports(property, value);
    }

    private hasCSSCustomProperties(): boolean {
        if (this.features.cssSupports) {
            return CSS.supports('--test', '0');
        }
        // Fallback detection
        const element = document.createElement('div');
        element.style.setProperty('--test', '0');
        return element.style.getPropertyValue('--test') === '0';
    }

    private hasImageFormat(format: string): Promise<boolean> {
        return new Promise<boolean>((resolve) => {
            const img = new Image();
            img.onload = () => resolve(true);
            img.onerror = () => resolve(false);

            const testImages: Record<string, string> = {
                webp: 'data:image/webp;base64,UklGRjoAAABXRUJQVlA4IC4AAACyAgCdASoCAAIALmk0mk0iIiIiIgBoSygABc6WWgAA/veff/0PP8bA//LwYAAA',
                avif: 'data:image/avif;base64,AAAAIGZ0eXBhdmlmAAAAAGF2aWZtaWYxbWlhZk1BMUIAAADybWV0YQAAAAAAAAAoaGRscgAAAAAAAAAAcGljdAAAAAAAAAAAAAAAAGxpYmF2aWYAAAAADnBpdG0AAAAAAAEAAAAeaWxvYwAAAABEAAABAAEAAAABAAABGgAAAB0AAAAoaWluZgAAAAAAAQAAABppbmZlAgAAAAABAABhdjAxQ29sb3IAAAAAamlwcnAAAABLaXBjbwAAABRpc3BlAAAAAAAAAAIAAAACAAAAEHBpeGkAAAAAAwgICAAAAAxhdjFDgQ0MAAAAABNjb2xybmNseAACAAIAAYAAAAAXaXBtYQAAAAAAAAABAAEEAQKDBAAAACVtZGF0EgAKCBgABogQEAwgMg8f8D///8WfhwB8+ErK42A='
            };

            img.src = testImages[format] || '';
        });
    }

    // Polyfill Loaders
    private async loadPromisePolyfill(): Promise<void> {
        if ('Promise' in window) return;

        // Simple Promise polyfill
        (window as any).Promise = class SimplePromise {
            private state: 'pending' | 'fulfilled' | 'rejected' = 'pending';
            private value: any;
            private handlers: Array<{ onFulfilled?: Function; onRejected?: Function; resolve: Function; reject: Function }> = [];

            constructor(executor: (resolve: Function, reject: Function) => void) {
                try {
                    executor(this.resolve.bind(this), this.reject.bind(this));
                } catch (error) {
                    this.reject(error);
                }
            }

            private resolve(value: any): void {
                if (this.state === 'pending') {
                    this.state = 'fulfilled';
                    this.value = value;
                    this.handlers.forEach(handler => this.handle(handler));
                    this.handlers = [];
                }
            }

            private reject(reason: any): void {
                if (this.state === 'pending') {
                    this.state = 'rejected';
                    this.value = reason;
                    this.handlers.forEach(handler => this.handle(handler));
                    this.handlers = [];
                }
            }

            private handle(handler: any): void {
                if (this.state === 'pending') {
                    this.handlers.push(handler);
                } else {
                    if (this.state === 'fulfilled' && handler.onFulfilled) {
                        handler.onFulfilled(this.value);
                    }
                    if (this.state === 'rejected' && handler.onRejected) {
                        handler.onRejected(this.value);
                    }
                }
            }

            then(onFulfilled?: Function, onRejected?: Function): any {
                return new (window as any).Promise((resolve: Function, reject: Function) => {
                    this.handle({
                        onFulfilled: onFulfilled ? (value: any) => {
                            try {
                                resolve(onFulfilled(value));
                            } catch (error) {
                                reject(error);
                            }
                        } : resolve,
                        onRejected: onRejected ? (reason: any) => {
                            try {
                                resolve(onRejected(reason));
                            } catch (error) {
                                reject(error);
                            }
                        } : reject,
                        resolve,
                        reject
                    });
                });
            }

            catch(onRejected: Function): any {
                return this.then(null, onRejected);
            }

            static resolve(value: any): any {
                return new (window as any).Promise((resolve: Function) => resolve(value));
            }

            static reject(reason: any): any {
                return new (window as any).Promise((_, reject: Function) => reject(reason));
            }
        };
    }

    private async loadFetchPolyfill(): Promise<void> {
        if ('fetch' in window) return;

        // Simple fetch polyfill using XMLHttpRequest
        (window as any).fetch = function (url: string, options: any = {}): Promise<Response> {
            return new Promise((resolve, reject) => {
                const xhr = new XMLHttpRequest();
                const method = options.method || 'GET';

                xhr.open(method, url);

                // Set headers
                if (options.headers) {
                    Object.keys(options.headers).forEach(key => {
                        xhr.setRequestHeader(key, options.headers[key]);
                    });
                }

                xhr.onload = () => {
                    const response = {
                        ok: xhr.status >= 200 && xhr.status < 300,
                        status: xhr.status,
                        statusText: xhr.statusText,
                        headers: new Map(),
                        json: () => Promise.resolve(JSON.parse(xhr.responseText)),
                        text: () => Promise.resolve(xhr.responseText),
                        blob: () => Promise.resolve(new Blob([xhr.response])),
                        arrayBuffer: () => Promise.resolve(xhr.response)
                    };
                    resolve(response as any);
                };

                xhr.onerror = () => reject(new Error('Network error'));
                xhr.ontimeout = () => reject(new Error('Request timeout'));

                if (options.timeout) {
                    xhr.timeout = options.timeout;
                }

                xhr.send(options.body);
            });
        };
    }

    private async loadIntersectionObserverPolyfill(): Promise<void> {
        if ('IntersectionObserver' in window) return;

        // Simplified IntersectionObserver polyfill
        (window as any).IntersectionObserver = class IntersectionObserver {
            private callback: Function;
            private options: any;
            private targets: Set<Element> = new Set();

            constructor(callback: Function, options: any = {}) {
                this.callback = callback;
                this.options = { threshold: 0, rootMargin: '0px', ...options };
                this.startPolling();
            }

            observe(target: Element): void {
                this.targets.add(target);
            }

            unobserve(target: Element): void {
                this.targets.delete(target);
            }

            disconnect(): void {
                this.targets.clear();
            }

            private startPolling(): void {
                setInterval(() => {
                    const entries: any[] = [];
                    this.targets.forEach(target => {
                        const rect = target.getBoundingClientRect();
                        const isIntersecting = rect.top < window.innerHeight && rect.bottom > 0;
                        entries.push({
                            target,
                            isIntersecting,
                            intersectionRatio: isIntersecting ? 1 : 0,
                            boundingClientRect: rect
                        });
                    });
                    if (entries.length > 0) {
                        this.callback(entries);
                    }
                }, 100);
            }
        };
    }

    private async loadResizeObserverPolyfill(): Promise<void> {
        if ('ResizeObserver' in window) return;

        // Simplified ResizeObserver polyfill
        (window as any).ResizeObserver = class ResizeObserver {
            private callback: Function;
            private targets: Set<Element> = new Set();
            private lastSizes: Map<Element, { width: number; height: number }> = new Map();

            constructor(callback: Function) {
                this.callback = callback;
                this.startPolling();
            }

            observe(target: Element): void {
                this.targets.add(target);
                const rect = target.getBoundingClientRect();
                this.lastSizes.set(target, { width: rect.width, height: rect.height });
            }

            unobserve(target: Element): void {
                this.targets.delete(target);
                this.lastSizes.delete(target);
            }

            disconnect(): void {
                this.targets.clear();
                this.lastSizes.clear();
            }

            private startPolling(): void {
                setInterval(() => {
                    const entries: any[] = [];
                    this.targets.forEach(target => {
                        const rect = target.getBoundingClientRect();
                        const lastSize = this.lastSizes.get(target);

                        if (!lastSize || lastSize.width !== rect.width || lastSize.height !== rect.height) {
                            this.lastSizes.set(target, { width: rect.width, height: rect.height });
                            entries.push({
                                target,
                                contentRect: rect
                            });
                        }
                    });

                    if (entries.length > 0) {
                        this.callback(entries);
                    }
                }, 100);
            }
        };
    }

    // CSS Fallback Methods
    private applyCSSGridFallback(): void {
        const style = document.createElement('style');
        style.textContent = `
            .grid-fallback {
                display: block;
            }
            .grid-fallback > * {
                display: inline-block;
                vertical-align: top;
                width: 100%;
                box-sizing: border-box;
            }
            @media (min-width: 768px) {
                .grid-fallback.grid-cols-2 > * {
                    width: 50%;
                }
                .grid-fallback.grid-cols-3 > * {
                    width: 33.333%;
                }
                .grid-fallback.grid-cols-4 > * {
                    width: 25%;
                }
            }
        `;
        document.head.appendChild(style);
        document.documentElement.classList.add('no-css-grid');
    }

    private applyCSSFlexboxFallback(): void {
        const style = document.createElement('style');
        style.textContent = `
            .flex-fallback {
                display: block;
            }
            .flex-fallback > * {
                display: inline-block;
                vertical-align: top;
            }
            .flex-fallback.justify-center {
                text-align: center;
            }
            .flex-fallback.justify-between > *:first-child {
                float: left;
            }
            .flex-fallback.justify-between > *:last-child {
                float: right;
            }
            .flex-fallback.justify-between::after {
                content: "";
                display: table;
                clear: both;
            }
        `;
        document.head.appendChild(style);
        document.documentElement.classList.add('no-css-flexbox');
    }

    private applyCSSCustomPropertiesFallback(): void {
        // Apply hardcoded values for CSS custom properties
        const style = document.createElement('style');
        style.textContent = `
            .no-css-custom-properties {
                --primary-color: #3b82f6;
                --secondary-color: #64748b;
                --success-color: #10b981;
                --warning-color: #f59e0b;
                --error-color: #ef4444;
                --text-color: #1f2937;
                --bg-color: #ffffff;
                --border-color: #d1d5db;
            }
            .no-css-custom-properties .btn-primary {
                background-color: #3b82f6;
                border-color: #3b82f6;
            }
            .no-css-custom-properties .text-primary {
                color: #3b82f6;
            }
            .no-css-custom-properties .bg-primary {
                background-color: #3b82f6;
            }
        `;
        document.head.appendChild(style);
        document.documentElement.classList.add('no-css-custom-properties');
    }

    // Progressive Enhancement Methods
    private addFeatureClasses(): void {
        const classes: string[] = [];

        Object.entries(this.features).forEach(([feature, supported]) => {
            classes.push(supported ? `has-${feature}` : `no-${feature}`);
        });

        document.documentElement.classList.add(...classes);
    }

    private setupInputMethodDetection(): void {
        let hasTouch = false;
        let hasMouse = false;

        const addTouchClass = () => {
            if (!hasTouch) {
                hasTouch = true;
                document.documentElement.classList.add('has-touch');
                document.documentElement.classList.remove('no-touch');
            }
        };

        const addMouseClass = () => {
            if (!hasMouse) {
                hasMouse = true;
                document.documentElement.classList.add('has-mouse');
                document.documentElement.classList.remove('no-mouse');
            }
        };

        // Initial state
        document.documentElement.classList.add('no-touch', 'no-mouse');

        // Touch detection
        if (this.features.touchEvents) {
            document.addEventListener('touchstart', addTouchClass, { once: true, passive: true });
        }

        // Mouse detection
        document.addEventListener('mousemove', addMouseClass, { once: true, passive: true });

        // Pointer events detection
        if (this.features.pointerEvents) {
            document.addEventListener('pointerdown', (e) => {
                if (e.pointerType === 'touch') {
                    addTouchClass();
                } else if (e.pointerType === 'mouse') {
                    addMouseClass();
                }
            }, { passive: true });
        }
    }

    // Public API
    public getFeatures(): BrowserFeatures {
        return { ...this.features };
    }

    public hasFeature(feature: keyof BrowserFeatures): boolean {
        return this.features[feature];
    }

    public async loadOptionalPolyfill(name: string): Promise<boolean> {
        if (this.polyfillsLoaded.has(name)) {
            return true;
        }

        try {
            switch (name) {
                case 'intersection-observer':
                    await this.loadIntersectionObserverPolyfill();
                    break;
                case 'resize-observer':
                    await this.loadResizeObserverPolyfill();
                    break;
                default:
                    console.warn(`[COMPATIBILITY] Unknown polyfill: ${name}`);
                    return false;
            }

            this.polyfillsLoaded.add(name);
            return true;
        } catch (error) {
            console.error(`[COMPATIBILITY] Failed to load ${name} polyfill:`, error);
            return false;
        }
    }

    public applyFallbackClass(element: Element, feature: string): void {
        if (!this.hasFeature(feature as keyof BrowserFeatures)) {
            element.classList.add(`${feature}-fallback`);
        }
    }
}

// Export singleton instance
export const browserCompatibility = new BrowserCompatibilityService();