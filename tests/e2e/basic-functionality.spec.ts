import { test, expect } from '@playwright/test';

test.describe('Basic Application Functionality', () => {
    test('should load the application homepage', async ({ page }) => {
        await page.goto('/');

        // Check if the page loads
        await expect(page).toHaveTitle(/AIC|Da'wa|College|Exam/);

        // Check for basic content
        await expect(page.locator('body')).toBeVisible();
    });

    test('should have working navigation', async ({ page }) => {
        await page.goto('/');

        // Look for navigation elements
        const navigation = page.locator('nav, .navigation, header');
        if (await navigation.count() > 0) {
            await expect(navigation.first()).toBeVisible();
        }

        // Look for main content area
        const main = page.locator('main, .main-content, #root');
        await expect(main.first()).toBeVisible();
    });

    test('should be responsive', async ({ page }) => {
        // Test desktop view
        await page.setViewportSize({ width: 1200, height: 800 });
        await page.goto('/');
        await expect(page.locator('body')).toBeVisible();

        // Test tablet view
        await page.setViewportSize({ width: 768, height: 1024 });
        await page.reload();
        await expect(page.locator('body')).toBeVisible();

        // Test mobile view
        await page.setViewportSize({ width: 375, height: 667 });
        await page.reload();
        await expect(page.locator('body')).toBeVisible();
    });

    test('should handle JavaScript errors gracefully', async ({ page }) => {
        const errors: string[] = [];

        page.on('console', msg => {
            if (msg.type() === 'error') {
                errors.push(msg.text());
            }
        });

        page.on('pageerror', error => {
            errors.push(error.message);
        });

        await page.goto('/');

        // Wait for page to fully load
        await page.waitForLoadState('networkidle');

        // Filter out known non-critical errors
        const criticalErrors = errors.filter(error =>
            !error.includes('favicon') &&
            !error.includes('manifest') &&
            !error.includes('service-worker') &&
            !error.includes('sw.js')
        );

        // Should not have critical JavaScript errors
        expect(criticalErrors.length).toBe(0);
    });

    test('should load within performance budget', async ({ page }) => {
        const startTime = Date.now();

        await page.goto('/');
        await page.waitForLoadState('domcontentloaded');

        const loadTime = Date.now() - startTime;

        // Should load within 3 seconds
        expect(loadTime).toBeLessThan(3000);
    });
});