import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test.describe('WCAG 2.1 AA Compliance Tests', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('/');
    });

    test('should not have any automatically detectable accessibility violations on homepage', async ({ page }) => {
        const accessibilityScanResults = await new AxeBuilder({ page })
            .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
            .analyze();

        expect(accessibilityScanResults.violations).toEqual([]);
    });

    test('should not have accessibility violations in public portal', async ({ page }) => {
        // Navigate to public portal
        await page.click('text=Public Portal');

        const accessibilityScanResults = await new AxeBuilder({ page })
            .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
            .analyze();

        expect(accessibilityScanResults.violations).toEqual([]);
    });

    test('should not have accessibility violations in admin interface', async ({ page }) => {
        // Login as admin
        const adminButton = page.locator('text=Admin Login, text=Faculty Entry, button:has-text("Admin")');
        if (await adminButton.count() > 0) {
            await adminButton.first().click();
            await page.fill('input[type="password"], input[placeholder*="password"]', '1234');
            await page.click('button:has-text("Login"), button:has-text("Enter")');

            const accessibilityScanResults = await new AxeBuilder({ page })
                .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
                .analyze();

            expect(accessibilityScanResults.violations).toEqual([]);
        }
    });

    test('should have proper heading hierarchy', async ({ page }) => {
        // Check heading structure
        const headings = await page.locator('h1, h2, h3, h4, h5, h6').all();

        if (headings.length > 0) {
            // Should have at least one h1
            const h1Count = await page.locator('h1').count();
            expect(h1Count).toBeGreaterThanOrEqual(1);

            // Check heading levels don't skip
            const headingLevels: number[] = [];
            for (const heading of headings) {
                const tagName = await heading.evaluate(el => el.tagName.toLowerCase());
                const level = parseInt(tagName.charAt(1));
                headingLevels.push(level);
            }

            // First heading should be h1
            expect(headingLevels[0]).toBe(1);

            // Check for proper hierarchy (no skipping levels)
            for (let i = 1; i < headingLevels.length; i++) {
                const currentLevel = headingLevels[i];
                const previousLevel = headingLevels[i - 1];

                // Should not skip more than one level
                expect(currentLevel - previousLevel).toBeLessThanOrEqual(1);
            }
        }
    });

    test('should have proper form labels and associations', async ({ page }) => {
        await page.click('text=Public Portal');

        const inputs = await page.locator('input[type="text"], input[type="password"], input[type="email"], input[type="search"]').all();

        for (const input of inputs) {
            const id = await input.getAttribute('id');
            const ariaLabel = await input.getAttribute('aria-label');
            const ariaLabelledBy = await input.getAttribute('aria-labelledby');
            const placeholder = await input.getAttribute('placeholder');

            // Should have proper labeling
            if (id) {
                const associatedLabel = await page.locator(`label[for="${id}"]`).count();
                expect(associatedLabel > 0 || ariaLabel || ariaLabelledBy || placeholder).toBeTruthy();
            } else {
                expect(ariaLabel || ariaLabelledBy || placeholder).toBeTruthy();
            }
        }
    });

    test('should have sufficient color contrast', async ({ page }) => {
        const accessibilityScanResults = await new AxeBuilder({ page })
            .withTags(['wcag2aa'])
            .include('*')
            .analyze();

        const colorContrastViolations = accessibilityScanResults.violations.filter(
            violation => violation.id === 'color-contrast'
        );

        expect(colorContrastViolations).toEqual([]);
    });

    test('should support keyboard navigation', async ({ page }) => {
        // Test tab navigation
        await page.keyboard.press('Tab');

        let focusedElement = page.locator(':focus');
        await expect(focusedElement).toBeVisible();

        // Continue tabbing through interactive elements
        for (let i = 0; i < 5; i++) {
            await page.keyboard.press('Tab');
            focusedElement = page.locator(':focus');

            if (await focusedElement.count() > 0) {
                await expect(focusedElement).toBeVisible();

                // Check if focus is visible
                const focusStyles = await focusedElement.evaluate(el => {
                    const computed = window.getComputedStyle(el);
                    return {
                        outline: computed.outline,
                        outlineWidth: computed.outlineWidth,
                        boxShadow: computed.boxShadow
                    };
                });

                // Should have visible focus indicator
                expect(
                    focusStyles.outline !== 'none' ||
                    focusStyles.outlineWidth !== '0px' ||
                    focusStyles.boxShadow !== 'none'
                ).toBeTruthy();
            }
        }
    });

    test('should have proper ARIA attributes', async ({ page }) => {
        // Check for proper ARIA usage
        const elementsWithAria = await page.locator('[aria-label], [aria-labelledby], [aria-describedby], [role]').all();

        for (const element of elementsWithAria) {
            const ariaLabel = await element.getAttribute('aria-label');
            const ariaLabelledBy = await element.getAttribute('aria-labelledby');
            const ariaDescribedBy = await element.getAttribute('aria-describedby');
            const role = await element.getAttribute('role');

            // If aria-labelledby is used, referenced element should exist
            if (ariaLabelledBy) {
                const referencedElement = await page.locator(`#${ariaLabelledBy}`).count();
                expect(referencedElement).toBeGreaterThan(0);
            }

            // If aria-describedby is used, referenced element should exist
            if (ariaDescribedBy) {
                const referencedElement = await page.locator(`#${ariaDescribedBy}`).count();
                expect(referencedElement).toBeGreaterThan(0);
            }

            // Role should be valid if present
            if (role) {
                const validRoles = [
                    'alert', 'alertdialog', 'application', 'article', 'banner', 'button',
                    'cell', 'checkbox', 'columnheader', 'combobox', 'complementary',
                    'contentinfo', 'dialog', 'directory', 'document', 'form', 'grid',
                    'gridcell', 'group', 'heading', 'img', 'link', 'list', 'listbox',
                    'listitem', 'log', 'main', 'marquee', 'math', 'menu', 'menubar',
                    'menuitem', 'menuitemcheckbox', 'menuitemradio', 'navigation', 'note',
                    'option', 'presentation', 'progressbar', 'radio', 'radiogroup',
                    'region', 'row', 'rowgroup', 'rowheader', 'scrollbar', 'search',
                    'separator', 'slider', 'spinbutton', 'status', 'tab', 'tablist',
                    'tabpanel', 'textbox', 'timer', 'toolbar', 'tooltip', 'tree',
                    'treegrid', 'treeitem'
                ];
                expect(validRoles).toContain(role);
            }
        }
    });

    test('should have proper image alt text', async ({ page }) => {
        const images = await page.locator('img').all();

        for (const img of images) {
            const alt = await img.getAttribute('alt');
            const role = await img.getAttribute('role');
            const ariaLabel = await img.getAttribute('aria-label');

            // Decorative images should have empty alt or role="presentation"
            // Content images should have descriptive alt text
            if (role === 'presentation' || role === 'none') {
                // Decorative image - alt can be empty
                expect(alt === '' || alt === null).toBeTruthy();
            } else {
                // Content image - should have alt text or aria-label
                expect(alt !== null || ariaLabel !== null).toBeTruthy();

                if (alt !== null && alt !== '') {
                    // Alt text should be descriptive (not just filename)
                    expect(alt.length).toBeGreaterThan(2);
                    expect(alt).not.toMatch(/\.(jpg|jpeg|png|gif|svg|webp)$/i);
                }
            }
        }
    });

    test('should have accessible form validation', async ({ page }) => {
        await page.click('text=Public Portal');

        const searchInput = page.locator('input[placeholder*="admission"]');

        // Try to submit empty form
        await page.click('button:has-text("Search")');

        // Check for accessible error messages
        const errorMessages = await page.locator('[role="alert"], .error-message, [aria-live="polite"], [aria-live="assertive"]').all();

        if (errorMessages.length > 0) {
            for (const errorMsg of errorMessages) {
                // Error messages should be associated with form fields
                const ariaDescribedBy = await searchInput.getAttribute('aria-describedby');
                const errorId = await errorMsg.getAttribute('id');

                if (errorId && ariaDescribedBy) {
                    expect(ariaDescribedBy.includes(errorId)).toBeTruthy();
                }
            }
        }
    });

    test('should support screen reader navigation landmarks', async ({ page }) => {
        // Check for proper landmark roles
        const landmarks = await page.locator('[role="main"], [role="navigation"], [role="banner"], [role="contentinfo"], [role="complementary"], main, nav, header, footer, aside').all();

        expect(landmarks.length).toBeGreaterThan(0);

        // Should have at least one main landmark
        const mainLandmarks = await page.locator('[role="main"], main').count();
        expect(mainLandmarks).toBeGreaterThanOrEqual(1);
    });

    test('should handle focus management in dynamic content', async ({ page }) => {
        await page.click('text=Public Portal');

        // Fill and submit search form
        await page.fill('input[placeholder*="admission"]', 'AD001');
        await page.click('button:has-text("Search")');

        // Wait for dynamic content
        await page.waitForTimeout(1000);

        // Focus should be managed appropriately
        // Either focus should move to results or an announcement should be made
        const focusedElement = page.locator(':focus');
        const liveRegions = await page.locator('[aria-live], [role="status"], [role="alert"]').count();

        // Should have either focused element or live region announcement
        expect((await focusedElement.count() > 0) || liveRegions > 0).toBeTruthy();
    });
});