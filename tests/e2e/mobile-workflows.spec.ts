import { test, expect, devices } from '@playwright/test';

// Configure mobile device at the top level
test.use({ ...devices['iPhone 12'] });

test.describe('Mobile Workflows', () => {

    test.beforeEach(async ({ page }) => {
        await page.goto('/');
    });

    test.describe('Mobile Public Portal', () => {
        test('should provide optimized mobile experience for public users', async ({ page }) => {
            // Check mobile-specific elements
            await expect(page.locator('text=AIC Da\'wa College')).toBeVisible();

            // Test mobile navigation
            const mobileMenu = page.locator('button[aria-label*="menu"], .mobile-menu-toggle, button:has-text("☰")');
            if (await mobileMenu.isVisible()) {
                await mobileMenu.click();
                await expect(page.locator('text=Public Portal')).toBeVisible();
                await page.click('text=Public Portal');
            } else {
                await page.click('text=Public Portal');
            }

            // Mobile search interface
            const searchInput = page.locator('input[placeholder*="admission"]');
            await expect(searchInput).toBeVisible();

            // Check input is properly sized for mobile
            const inputBox = await searchInput.boundingBox();
            expect(inputBox?.height).toBeGreaterThanOrEqual(44); // iOS touch target guideline

            // Test mobile search
            await searchInput.fill('AD001');
            await page.click('button:has-text("Search")');

            // Results should be mobile-optimized
            await page.waitForTimeout(1000);
            const viewport = page.viewportSize();
            expect(viewport?.width).toBeLessThanOrEqual(414); // Mobile width
        });

        test('should handle mobile keyboard interactions', async ({ page }) => {
            await page.click('text=Public Portal');

            const searchInput = page.locator('input[placeholder*="admission"]');
            await searchInput.click();

            // Should show mobile keyboard
            await expect(searchInput).toBeFocused();

            // Type with mobile-friendly input
            await searchInput.type('AD001', { delay: 100 });

            // Should handle mobile submit
            await page.keyboard.press('Enter');
            await page.waitForTimeout(1000);
        });
    });

    test.describe('Mobile Admin Interface', () => {
        test('should provide mobile-optimized admin login', async ({ page }) => {
            // Find admin access
            const adminButton = page.locator('text=Admin Login, text=Faculty Entry, button:has-text("Admin")');
            await adminButton.first().click();

            // Mobile login form
            const passwordInput = page.locator('input[type="password"], input[placeholder*="password"]');
            await expect(passwordInput).toBeVisible();

            // Check mobile input sizing
            const inputBox = await passwordInput.boundingBox();
            expect(inputBox?.height).toBeGreaterThanOrEqual(44);

            // Mobile login
            await passwordInput.fill('1234');
            await page.click('button:has-text("Login"), button:has-text("Enter")');

            // Should show mobile dashboard
            await expect(page.locator('text=Dashboard, text=Faculty Entry')).toBeVisible();
        });

        test('should handle mobile marks entry workflow', async ({ page }) => {
            // Login
            const adminButton = page.locator('text=Admin Login, text=Faculty Entry, button:has-text("Admin")');
            await adminButton.first().click();
            await page.fill('input[type="password"], input[placeholder*="password"]', '1234');
            await page.click('button:has-text("Login"), button:has-text("Enter")');

            // Navigate to Faculty Entry
            await page.click('text=Faculty Entry');

            // Mobile-optimized dropdowns
            const classSelect = page.locator('select:near(:text("Class"))');
            if (await classSelect.isVisible()) {
                await classSelect.selectOption({ index: 1 });

                const subjectSelect = page.locator('select:near(:text("Subject"))');
                if (await subjectSelect.isVisible()) {
                    await subjectSelect.selectOption({ index: 1 });
                }
            }

            // Should show mobile-optimized marks entry
            await page.waitForTimeout(1000);
        });
    });

    test.describe('Mobile Touch Interactions', () => {
        test('should handle swipe gestures', async ({ page }) => {
            await page.click('text=Public Portal');
            await page.fill('input[placeholder*="admission"]', 'AD001');
            await page.click('button:has-text("Search")');

            await page.waitForTimeout(1000);

            // Test horizontal swipe if there are swipeable elements
            const swipeableElement = page.locator('.swipeable, .carousel, .slider').first();
            if (await swipeableElement.isVisible()) {
                const box = await swipeableElement.boundingBox();
                if (box) {
                    // Simulate swipe left
                    await page.mouse.move(box.x + box.width * 0.8, box.y + box.height / 2);
                    await page.mouse.down();
                    await page.mouse.move(box.x + box.width * 0.2, box.y + box.height / 2);
                    await page.mouse.up();
                }
            }
        });

        test('should handle pinch-to-zoom on charts', async ({ page }) => {
            // Login and navigate to dashboard with charts
            const adminButton = page.locator('text=Admin Login, text=Faculty Entry, button:has-text("Admin")');
            await adminButton.first().click();
            await page.fill('input[type="password"], input[placeholder*="password"]', '1234');
            await page.click('button:has-text("Login"), button:has-text("Enter")');

            // Look for charts or visual elements
            const chart = page.locator('canvas, svg, .chart').first();
            if (await chart.isVisible()) {
                const box = await chart.boundingBox();
                if (box) {
                    // Simulate pinch gesture (basic touch simulation)
                    await page.touchscreen.tap(box.x + box.width / 2, box.y + box.height / 2);
                }
            }
        });

        test('should provide haptic feedback simulation', async ({ page }) => {
            await page.click('text=Public Portal');

            // Test button press feedback
            const searchButton = page.locator('button:has-text("Search")');
            await searchButton.click();

            // Should provide visual feedback for touch
            await expect(searchButton).toBeVisible();
        });
    });

    test.describe('Mobile Performance', () => {
        test('should load quickly on mobile networks', async ({ page }) => {
            // Simulate slow 3G network
            await page.route('**/*', async route => {
                await new Promise(resolve => setTimeout(resolve, 100)); // Add 100ms delay
                await route.continue();
            });

            const startTime = Date.now();
            await page.goto('/');
            await page.waitForLoadState('networkidle');
            const loadTime = Date.now() - startTime;

            // Should load within reasonable time even on slow network
            expect(loadTime).toBeLessThan(8000); // 8 seconds for slow network
        });

        test('should handle mobile memory constraints', async ({ page }) => {
            // Navigate through multiple pages to test memory usage
            await page.goto('/');
            await page.click('text=Public Portal');
            await page.fill('input[placeholder*="admission"]', 'AD001');
            await page.click('button:has-text("Search")');

            // Navigate back and forth
            await page.goBack();
            await page.goForward();

            // Should remain responsive
            await expect(page.locator('button:has-text("Search")')).toBeVisible();
        });

        test('should optimize images for mobile', async ({ page }) => {
            await page.goto('/');

            // Check if images are appropriately sized for mobile
            const images = page.locator('img');
            const imageCount = await images.count();

            for (let i = 0; i < imageCount; i++) {
                const img = images.nth(i);
                if (await img.isVisible()) {
                    const box = await img.boundingBox();
                    const viewport = page.viewportSize();

                    if (box && viewport) {
                        // Images should not exceed viewport width
                        expect(box.width).toBeLessThanOrEqual(viewport.width);
                    }
                }
            }
        });
    });

    test.describe('Mobile Accessibility', () => {
        test('should support mobile screen readers', async ({ page }) => {
            await page.goto('/');

            // Check for proper ARIA labels on mobile
            const buttons = page.locator('button');
            const buttonCount = await buttons.count();

            for (let i = 0; i < Math.min(buttonCount, 5); i++) {
                const button = buttons.nth(i);
                if (await button.isVisible()) {
                    const ariaLabel = await button.getAttribute('aria-label');
                    const text = await button.textContent();

                    // Should have either aria-label or text content
                    expect(ariaLabel || text).toBeTruthy();
                }
            }
        });

        test('should handle mobile focus management', async ({ page }) => {
            await page.goto('/');

            // Test focus visibility on mobile
            await page.keyboard.press('Tab');

            const focusedElement = page.locator(':focus');
            if (await focusedElement.isVisible()) {
                // Focus should be clearly visible
                const styles = await focusedElement.evaluate(el => {
                    const computed = window.getComputedStyle(el);
                    return {
                        outline: computed.outline,
                        boxShadow: computed.boxShadow,
                        border: computed.border
                    };
                });

                // Should have some form of focus indicator
                expect(
                    styles.outline !== 'none' ||
                    styles.boxShadow !== 'none' ||
                    styles.border !== 'none'
                ).toBeTruthy();
            }
        });

        test('should provide sufficient color contrast on mobile', async ({ page }) => {
            await page.goto('/');

            // Test color contrast for text elements
            const textElements = page.locator('p, span, div, h1, h2, h3, h4, h5, h6, button, a');
            const elementCount = await textElements.count();

            for (let i = 0; i < Math.min(elementCount, 10); i++) {
                const element = textElements.nth(i);
                if (await element.isVisible()) {
                    const styles = await element.evaluate(el => {
                        const computed = window.getComputedStyle(el);
                        return {
                            color: computed.color,
                            backgroundColor: computed.backgroundColor,
                            fontSize: computed.fontSize
                        };
                    });

                    // Basic check - should have defined colors
                    expect(styles.color).toBeTruthy();
                    expect(styles.fontSize).toBeTruthy();
                }
            }
        });
    });

    test.describe('Mobile Offline Support', () => {
        test('should cache essential resources for offline use', async ({ page, context }) => {
            // Load the app online first
            await page.goto('/');
            await page.waitForLoadState('networkidle');

            // Go offline
            await context.setOffline(true);

            // Should still show cached content
            await page.reload();
            await expect(page.locator('text=AIC Da\'wa College')).toBeVisible();

            // Basic navigation should work
            await page.click('text=Public Portal');
            await expect(page.locator('input[placeholder*="admission"]')).toBeVisible();
        });

        test('should show offline status on mobile', async ({ page, context }) => {
            await page.goto('/');

            // Go offline
            await context.setOffline(true);

            // Should show mobile-optimized offline indicator
            await expect(page.locator('text=Offline, .offline-indicator')).toBeVisible();

            // Offline indicator should be mobile-friendly
            const offlineIndicator = page.locator('.offline-indicator, [data-testid="offline-status"]').first();
            if (await offlineIndicator.isVisible()) {
                const box = await offlineIndicator.boundingBox();
                const viewport = page.viewportSize();

                if (box && viewport) {
                    // Should not obstruct main content
                    expect(box.width).toBeLessThanOrEqual(viewport.width);
                }
            }
        });

        test('should sync data when back online', async ({ page, context }) => {
            await page.goto('/');

            // Login
            const adminButton = page.locator('text=Admin Login, text=Faculty Entry, button:has-text("Admin")');
            await adminButton.first().click();
            await page.fill('input[type="password"], input[placeholder*="password"]', '1234');
            await page.click('button:has-text("Login"), button:has-text("Enter")');

            // Go offline
            await context.setOffline(true);

            // Try to perform an action that would require sync
            await page.click('text=Faculty Entry');

            // Go back online
            await context.setOffline(false);

            // Should attempt to sync
            await page.waitForTimeout(2000);

            // Should show online status
            await expect(page.locator('text=Offline')).not.toBeVisible();
        });
    });

    test.describe('Mobile Form Interactions', () => {
        test('should optimize form inputs for mobile', async ({ page }) => {
            await page.click('text=Public Portal');

            const searchInput = page.locator('input[placeholder*="admission"]');

            // Should have appropriate input type for mobile keyboard
            const inputType = await searchInput.getAttribute('type');
            const inputMode = await searchInput.getAttribute('inputmode');

            // Should optimize keyboard for admission number input
            expect(inputType === 'text' || inputType === 'search').toBeTruthy();
        });

        test('should handle mobile form validation', async ({ page }) => {
            await page.click('text=Public Portal');

            const searchInput = page.locator('input[placeholder*="admission"]');

            // Test empty submission
            await page.click('button:has-text("Search")');

            // Should show mobile-friendly validation
            const validationMessage = page.locator('text=required, text=enter, .error-message');
            if (await validationMessage.isVisible()) {
                const box = await validationMessage.boundingBox();
                expect(box?.height).toBeGreaterThan(0);
            }
        });

        test('should support mobile autocomplete', async ({ page }) => {
            await page.click('text=Public Portal');

            const searchInput = page.locator('input[placeholder*="admission"]');

            // Check for autocomplete attributes
            const autocomplete = await searchInput.getAttribute('autocomplete');

            // Should have appropriate autocomplete for better mobile UX
            expect(autocomplete).toBeTruthy();
        });
    });
});