import { test, expect } from '@playwright/test';

test.describe('Performance Regression Tests', () => {
    test.beforeEach(async ({ page }) => {
        // Set up performance monitoring
        await page.goto('/');
    });

    test('should meet Core Web Vitals thresholds', async ({ page }) => {
        // Navigate to the page and wait for load
        await page.goto('/');
        await page.waitForLoadState('networkidle');

        // Get Core Web Vitals metrics
        const metrics = await page.evaluate(() => {
            return new Promise((resolve) => {
                const observer = new PerformanceObserver((list) => {
                    const entries = list.getEntries();
                    const vitals: Record<string, number> = {};

                    entries.forEach((entry) => {
                        if (entry.entryType === 'navigation') {
                            const navEntry = entry as PerformanceNavigationTiming;
                            vitals.FCP = navEntry.responseStart - navEntry.fetchStart;
                            vitals.LCP = navEntry.loadEventEnd - navEntry.fetchStart;
                        }
                    });

                    resolve(vitals);
                });

                observer.observe({ entryTypes: ['navigation', 'paint', 'largest-contentful-paint'] });

                // Fallback timeout
                setTimeout(() => {
                    resolve({
                        FCP: performance.now(),
                        LCP: performance.now()
                    });
                }, 5000);
            });
        });

        // Core Web Vitals thresholds (in milliseconds)
        // FCP (First Contentful Paint): Good < 1800ms
        // LCP (Largest Contentful Paint): Good < 2500ms
        expect(metrics.FCP).toBeLessThan(1800);
        expect(metrics.LCP).toBeLessThan(2500);
    });

    test('should load within performance budget', async ({ page }) => {
        const startTime = Date.now();

        await page.goto('/');
        await page.waitForLoadState('domcontentloaded');

        const domContentLoadedTime = Date.now() - startTime;

        await page.waitForLoadState('networkidle');
        const fullyLoadedTime = Date.now() - startTime;

        // Performance budgets
        expect(domContentLoadedTime).toBeLessThan(2000); // 2 seconds for DOM ready
        expect(fullyLoadedTime).toBeLessThan(5000); // 5 seconds for full load
    });

    test('should have acceptable bundle sizes', async ({ page }) => {
        // Monitor network requests
        const resourceSizes: Record<string, number> = {};

        page.on('response', async (response) => {
            const url = response.url();
            const contentLength = response.headers()['content-length'];

            if (contentLength) {
                resourceSizes[url] = parseInt(contentLength);
            }
        });

        await page.goto('/');
        await page.waitForLoadState('networkidle');

        // Check JavaScript bundle sizes
        const jsResources = Object.entries(resourceSizes).filter(([url]) =>
            url.includes('.js') && !url.includes('node_modules')
        );

        const totalJSSize = jsResources.reduce((total, [, size]) => total + size, 0);

        // JavaScript bundle should be under 1MB
        expect(totalJSSize).toBeLessThan(1024 * 1024);

        // Individual JS files should be under 500KB
        jsResources.forEach(([url, size]) => {
            expect(size).toBeLessThan(500 * 1024);
        });
    });

    test('should handle concurrent users efficiently', async ({ browser }) => {
        const contexts = await Promise.all([
            browser.newContext(),
            browser.newContext(),
            browser.newContext(),
            browser.newContext(),
            browser.newContext()
        ]);

        const pages = await Promise.all(
            contexts.map(context => context.newPage())
        );

        const startTime = Date.now();

        // Simulate 5 concurrent users
        await Promise.all(
            pages.map(async (page, index) => {
                await page.goto('/');
                await page.waitForLoadState('networkidle');

                // Simulate different user actions
                if (index % 2 === 0) {
                    await page.click('text=Public Portal');
                    await page.fill('input[placeholder*="admission"]', `AD00${index + 1}`);
                    await page.click('button:has-text("Search")');
                } else {
                    const adminButton = page.locator('text=Admin Login, text=Faculty Entry, button:has-text("Admin")');
                    if (await adminButton.count() > 0) {
                        await adminButton.first().click();
                        await page.fill('input[type="password"], input[placeholder*="password"]', '1234');
                        await page.click('button:has-text("Login"), button:has-text("Enter")');
                    }
                }
            })
        );

        const totalTime = Date.now() - startTime;

        // Should handle concurrent users within reasonable time
        expect(totalTime).toBeLessThan(10000); // 10 seconds for 5 concurrent users

        // Clean up
        await Promise.all(contexts.map(context => context.close()));
    });

    test('should maintain performance on mobile devices', async ({ browser }) => {
        const context = await browser.newContext({
            ...browser.contexts()[0] || {},
            viewport: { width: 375, height: 667 },
            userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_0 like Mac OS X) AppleWebKit/605.1.15'
        });

        const page = await context.newPage();

        const startTime = Date.now();
        await page.goto('/');
        await page.waitForLoadState('networkidle');
        const loadTime = Date.now() - startTime;

        // Mobile should load within 6 seconds (allowing for slower networks)
        expect(loadTime).toBeLessThan(6000);

        // Test mobile interactions
        await page.click('text=Public Portal');
        const interactionStart = Date.now();
        await page.fill('input[placeholder*="admission"]', 'AD001');
        await page.click('button:has-text("Search")');
        const interactionTime = Date.now() - interactionStart;

        // Mobile interactions should be responsive
        expect(interactionTime).toBeLessThan(2000);

        await context.close();
    });

    test('should handle memory usage efficiently', async ({ page }) => {
        await page.goto('/');

        // Get initial memory usage
        const initialMemory = await page.evaluate(() => {
            return (performance as any).memory ? {
                usedJSHeapSize: (performance as any).memory.usedJSHeapSize,
                totalJSHeapSize: (performance as any).memory.totalJSHeapSize
            } : { usedJSHeapSize: 0, totalJSHeapSize: 0 };
        });

        // Perform memory-intensive operations
        for (let i = 0; i < 10; i++) {
            await page.click('text=Public Portal');
            await page.fill('input[placeholder*="admission"]', `AD${i.toString().padStart(3, '0')}`);
            await page.click('button:has-text("Search")');
            await page.waitForTimeout(500);

            // Navigate back
            await page.goBack();
            await page.waitForTimeout(500);
        }

        // Get final memory usage
        const finalMemory = await page.evaluate(() => {
            return (performance as any).memory ? {
                usedJSHeapSize: (performance as any).memory.usedJSHeapSize,
                totalJSHeapSize: (performance as any).memory.totalJSHeapSize
            } : { usedJSHeapSize: 0, totalJSHeapSize: 0 };
        });

        // Memory usage should not increase dramatically
        if (initialMemory.usedJSHeapSize > 0 && finalMemory.usedJSHeapSize > 0) {
            const memoryIncrease = finalMemory.usedJSHeapSize - initialMemory.usedJSHeapSize;
            const memoryIncreasePercentage = (memoryIncrease / initialMemory.usedJSHeapSize) * 100;

            // Memory increase should be less than 50%
            expect(memoryIncreasePercentage).toBeLessThan(50);
        }
    });

    test('should optimize image loading', async ({ page }) => {
        const imageLoadTimes: number[] = [];

        page.on('response', async (response) => {
            const url = response.url();
            if (url.match(/\.(jpg|jpeg|png|gif|svg|webp)$/i)) {
                const timing = response.timing();
                imageLoadTimes.push(timing.responseEnd - timing.requestStart);
            }
        });

        await page.goto('/');
        await page.waitForLoadState('networkidle');

        if (imageLoadTimes.length > 0) {
            const averageImageLoadTime = imageLoadTimes.reduce((sum, time) => sum + time, 0) / imageLoadTimes.length;

            // Images should load within 2 seconds on average
            expect(averageImageLoadTime).toBeLessThan(2000);

            // No single image should take more than 5 seconds
            imageLoadTimes.forEach(loadTime => {
                expect(loadTime).toBeLessThan(5000);
            });
        }
    });

    test('should handle API response times efficiently', async ({ page }) => {
        const apiResponseTimes: number[] = [];

        page.on('response', async (response) => {
            const url = response.url();
            if (url.includes('/api/') || url.includes('firebase') || url.includes('gemini')) {
                const timing = response.timing();
                apiResponseTimes.push(timing.responseEnd - timing.requestStart);
            }
        });

        await page.goto('/');

        // Trigger API calls
        await page.click('text=Public Portal');
        await page.fill('input[placeholder*="admission"]', 'AD001');
        await page.click('button:has-text("Search")');
        await page.waitForTimeout(2000);

        if (apiResponseTimes.length > 0) {
            const averageApiResponseTime = apiResponseTimes.reduce((sum, time) => sum + time, 0) / apiResponseTimes.length;

            // API calls should respond within 3 seconds on average
            expect(averageApiResponseTime).toBeLessThan(3000);

            // No single API call should take more than 10 seconds
            apiResponseTimes.forEach(responseTime => {
                expect(responseTime).toBeLessThan(10000);
            });
        }
    });

    test('should maintain performance with large datasets', async ({ page }) => {
        // Login as admin
        const adminButton = page.locator('text=Admin Login, text=Faculty Entry, button:has-text("Admin")');
        if (await adminButton.count() > 0) {
            await adminButton.first().click();
            await page.fill('input[type="password"], input[placeholder*="password"]', '1234');
            await page.click('button:has-text("Login"), button:has-text("Enter")');

            // Navigate to a data-heavy section
            await page.click('text=Class Results, text=Dashboard');

            const startTime = Date.now();
            await page.waitForLoadState('networkidle');
            const renderTime = Date.now() - startTime;

            // Large datasets should render within 5 seconds
            expect(renderTime).toBeLessThan(5000);

            // Test scrolling performance with large lists
            const scrollableElement = page.locator('table, .data-table, .student-list').first();
            if (await scrollableElement.count() > 0) {
                const scrollStart = Date.now();

                // Simulate scrolling
                for (let i = 0; i < 5; i++) {
                    await scrollableElement.evaluate(el => {
                        el.scrollTop += 200;
                    });
                    await page.waitForTimeout(100);
                }

                const scrollTime = Date.now() - scrollStart;

                // Scrolling should be smooth (under 1 second for 5 scroll actions)
                expect(scrollTime).toBeLessThan(1000);
            }
        }
    });

    test('should optimize font loading', async ({ page }) => {
        const fontLoadTimes: number[] = [];

        page.on('response', async (response) => {
            const url = response.url();
            if (url.match(/\.(woff|woff2|ttf|otf|eot)$/i)) {
                const timing = response.timing();
                fontLoadTimes.push(timing.responseEnd - timing.requestStart);
            }
        });

        await page.goto('/');
        await page.waitForLoadState('networkidle');

        if (fontLoadTimes.length > 0) {
            const averageFontLoadTime = fontLoadTimes.reduce((sum, time) => sum + time, 0) / fontLoadTimes.length;

            // Fonts should load within 2 seconds on average
            expect(averageFontLoadTime).toBeLessThan(2000);
        }

        // Check for font display optimization
        const fontFaces = await page.evaluate(() => {
            const stylesheets = Array.from(document.styleSheets);
            const fontDisplayValues: string[] = [];

            stylesheets.forEach(stylesheet => {
                try {
                    const rules = Array.from(stylesheet.cssRules || []);
                    rules.forEach(rule => {
                        if (rule instanceof CSSFontFaceRule) {
                            const fontDisplay = rule.style.getPropertyValue('font-display');
                            if (fontDisplay) {
                                fontDisplayValues.push(fontDisplay);
                            }
                        }
                    });
                } catch (e) {
                    // Cross-origin stylesheets may not be accessible
                }
            });

            return fontDisplayValues;
        });

        // Should use font-display: swap or fallback for better performance
        if (fontFaces.length > 0) {
            fontFaces.forEach(fontDisplay => {
                expect(['swap', 'fallback', 'optional']).toContain(fontDisplay);
            });
        }
    });
});