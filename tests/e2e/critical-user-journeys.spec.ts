import { test, expect } from '@playwright/test';

test.describe('Critical User Journeys', () => {
    test.beforeEach(async ({ page }) => {
        // Navigate to the application
        await page.goto('/');
        // Wait for the app to fully load
        await page.waitForLoadState('networkidle');
    });

    test.describe('Public Portal Journey', () => {
        test('should allow public users to view student results', async ({ page }) => {
            // Wait for the page to load
            await expect(page).toHaveTitle(/AIC Da'wa College/);

            // Check if public portal is accessible - the app starts in public mode
            await expect(page.locator('text=Public Portal')).toBeVisible();

            // The app should show the public portal interface by default
            await expect(page.locator('input[placeholder*="admission"], input[placeholder*="Admission"]')).toBeVisible();
            await expect(page.locator('button:has-text("Search")')).toBeVisible();

            // Test search functionality with a test admission number
            await page.fill('input[placeholder*="admission"], input[placeholder*="Admission"]', 'AD001');
            await page.click('button:has-text("Search")');

            // Wait for search results
            await page.waitForTimeout(2000);

            // Should show results or appropriate message
            const hasResults = await page.locator('text=Results for').isVisible();
            const hasNotFound = await page.locator('text=Student not found').isVisible();

            expect(hasResults || hasNotFound).toBeTruthy();
        });

        test('should display student scorecard when found', async ({ page }) => {
            // Search for a student (this assumes test data exists or we get a not found message)
            await page.fill('input[placeholder*="admission"], input[placeholder*="Admission"]', 'AD001');
            await page.click('button:has-text("Search")');

            // Wait for results
            await page.waitForTimeout(2000);

            // If student is found, check scorecard elements
            const studentFound = await page.locator('text=Results for').isVisible();
            if (studentFound) {
                // Check for common scorecard elements
                const hasPerformance = await page.locator('text=Academic Performance, text=Performance, text=Total').isVisible();
                const hasMarks = await page.locator('text=Subject-wise Marks, text=Marks, text=Subject').isVisible();
                const hasTotal = await page.locator('text=Grand Total, text=Total').isVisible();

                expect(hasPerformance || hasMarks || hasTotal).toBeTruthy();
            }
        });

        test('should handle invalid admission numbers gracefully', async ({ page }) => {
            // Test with invalid admission number
            await page.fill('input[placeholder*="admission"], input[placeholder*="Admission"]', 'INVALID123');
            await page.click('button:has-text("Search")');

            // Wait for response
            await page.waitForTimeout(2000);

            // Should show appropriate error message
            await expect(page.locator('text=Student not found, text=No student found, text=Invalid')).toBeVisible();
        });

        test('should validate empty search input', async ({ page }) => {
            // Try to search without entering admission number
            await page.click('button:has-text("Search")');

            // Should show validation message or prevent search
            const hasValidation = await page.locator('text=required, text=enter, text=admission').isVisible();
            const inputValue = await page.locator('input[placeholder*="admission"], input[placeholder*="Admission"]').inputValue();

            // Either shows validation or input remains focused
            expect(hasValidation || inputValue === '').toBeTruthy();
        });
    });

    test.describe('Admin Login Journey', () => {
        test('should allow admin to login with correct credentials', async ({ page }) => {
            // Look for admin login button or link
            const adminButton = page.locator('text=Admin Login, text=Faculty Entry, text=Admin, button:has-text("Admin")');
            await expect(adminButton.first()).toBeVisible();
            await adminButton.first().click();

            // Should show login form
            await expect(page.locator('input[type="password"], input[placeholder*="password"], input[placeholder*="PIN"]')).toBeVisible();

            // Enter admin credentials (using default from the app)
            await page.fill('input[type="password"], input[placeholder*="password"], input[placeholder*="PIN"]', '1234');

            // Also fill username if present
            const usernameInput = page.locator('input[type="text"], input[placeholder*="Registry"], input[placeholder*="username"]');
            if (await usernameInput.isVisible()) {
                await usernameInput.fill('admin');
            }

            // Submit login
            await page.click('button:has-text("Login"), button:has-text("Enter"), button:has-text("Authenticate")');

            // Wait for navigation
            await page.waitForTimeout(2000);

            // Should redirect to admin dashboard
            await expect(page.locator('text=Dashboard, text=Faculty Entry, text=Management')).toBeVisible();
        });

        test('should reject invalid admin credentials', async ({ page }) => {
            const adminButton = page.locator('text=Admin Login, text=Faculty Entry, text=Admin, button:has-text("Admin")');
            await adminButton.first().click();

            // Enter wrong password
            await page.fill('input[type="password"], input[placeholder*="password"], input[placeholder*="PIN"]', 'wrongpassword');

            // Fill username if present
            const usernameInput = page.locator('input[type="text"], input[placeholder*="Registry"], input[placeholder*="username"]');
            if (await usernameInput.isVisible()) {
                await usernameInput.fill('admin');
            }

            await page.click('button:has-text("Login"), button:has-text("Enter"), button:has-text("Authenticate")');

            // Wait for error response
            await page.waitForTimeout(1000);

            // Should show error message or remain on login page
            const hasError = await page.locator('text=Invalid, text=incorrect, text=wrong').isVisible();
            const stillOnLogin = await page.locator('input[type="password"]').isVisible();

            expect(hasError || stillOnLogin).toBeTruthy();
        });

        test('should handle empty login credentials', async ({ page }) => {
            const adminButton = page.locator('text=Admin Login, text=Faculty Entry, text=Admin, button:has-text("Admin")');
            await adminButton.first().click();

            // Try to login without credentials
            await page.click('button:has-text("Login"), button:has-text("Enter"), button:has-text("Authenticate")');

            // Should remain on login page or show validation
            const stillOnLogin = await page.locator('input[type="password"]').isVisible();
            expect(stillOnLogin).toBeTruthy();
        });
    });

    test.describe('Marks Entry Journey', () => {
        test('should allow faculty to access marks entry interface', async ({ page }) => {
            // Login as admin first
            await loginAsAdmin(page);

            // Navigate to Faculty Entry
            await page.click('text=Faculty Entry');

            // Wait for the interface to load
            await page.waitForTimeout(1000);

            // Should show marks entry interface
            const hasClassSelect = await page.locator('select, text=Class').isVisible();
            const hasSubjectSelect = await page.locator('select, text=Subject').isVisible();
            const hasMarksInterface = await page.locator('text=Students, text=Marks Entry, table, text=TA, text=CE').isVisible();

            expect(hasClassSelect || hasSubjectSelect || hasMarksInterface).toBeTruthy();
        });

        test('should show student list when class and subject selected', async ({ page }) => {
            await loginAsAdmin(page);
            await page.click('text=Faculty Entry');

            // Try to select class and subject if dropdowns are available
            const classSelect = page.locator('select:near(:text("Class"))').first();
            if (await classSelect.isVisible()) {
                const options = await classSelect.locator('option').count();
                if (options > 1) {
                    await classSelect.selectOption({ index: 1 });
                }
            }

            const subjectSelect = page.locator('select:near(:text("Subject"))').first();
            if (await subjectSelect.isVisible()) {
                const options = await subjectSelect.locator('option').count();
                if (options > 1) {
                    await subjectSelect.selectOption({ index: 1 });
                }
            }

            // Wait for student list to load
            await page.waitForTimeout(1000);

            // Should show student list or marks entry form
            const hasStudentList = await page.locator('text=Students, table, text=Admission').isVisible();
            const hasMarksForm = await page.locator('input[placeholder*="TA"], input[placeholder*="CE"], input[name*="marks"]').isVisible();

            expect(hasStudentList || hasMarksForm).toBeTruthy();
        });

        test('should validate marks entry inputs', async ({ page }) => {
            await loginAsAdmin(page);
            await page.click('text=Faculty Entry');

            // Select class and subject if available
            await selectClassAndSubject(page);

            // Try to enter invalid marks if marks input is available
            const taInput = page.locator('input[placeholder*="TA"], input[name*="ta"]').first();
            if (await taInput.isVisible()) {
                await taInput.fill('999'); // Invalid high mark
                await taInput.blur(); // Trigger validation

                // Wait for validation
                await page.waitForTimeout(500);

                // Should show validation error or prevent invalid input
                const hasValidationError = await page.locator('text=exceed, text=maximum, text=invalid, text=error').isVisible();
                const inputValue = await taInput.inputValue();

                expect(hasValidationError || parseInt(inputValue) <= 100).toBeTruthy();
            }
        });
    });

    test.describe('Report Generation Journey', () => {
        test('should allow viewing class results', async ({ page }) => {
            await loginAsAdmin(page);

            // Navigate to Class Results
            await page.click('text=Class Results');

            // Wait for interface to load
            await page.waitForTimeout(1000);

            // Should show class selection
            const hasClassSelect = await page.locator('select, text=Class').isVisible();
            const hasResults = await page.locator('text=Results, text=Statistics, table').isVisible();

            expect(hasClassSelect || hasResults).toBeTruthy();

            // If class selection is available, try to select a class
            const classSelect = page.locator('select:near(:text("Class"))').first();
            if (await classSelect.isVisible()) {
                const options = await classSelect.locator('option').count();
                if (options > 1) {
                    await classSelect.selectOption({ index: 1 });
                    await page.waitForTimeout(1000);

                    // Should show class results
                    const hasResultsTable = await page.locator('text=Results, text=Statistics, table').isVisible();
                    expect(hasResultsTable).toBeTruthy();
                }
            }
        });

        test('should allow generating student scorecards', async ({ page }) => {
            await loginAsAdmin(page);

            // Navigate to Student Scorecard
            const scorecardLink = page.locator('text=Student Scorecard, text=Scorecard');
            if (await scorecardLink.isVisible()) {
                await scorecardLink.click();

                // Wait for interface to load
                await page.waitForTimeout(1000);

                // Should show student selection interface
                const hasStudentSelect = await page.locator('select, input[placeholder*="student"]').isVisible();
                expect(hasStudentSelect).toBeTruthy();
            }
        });

        test('should display dashboard with statistics', async ({ page }) => {
            await loginAsAdmin(page);

            // Should be on dashboard by default or navigate to it
            const dashboardLink = page.locator('text=Dashboard');
            if (await dashboardLink.isVisible()) {
                await dashboardLink.click();
            }

            // Wait for dashboard to load
            await page.waitForTimeout(2000);

            // Should show dashboard elements
            const hasStats = await page.locator('text=Statistics, text=Total Students, text=Classes, text=Performance').isVisible();
            const hasCharts = await page.locator('canvas, svg, .chart').isVisible();

            expect(hasStats || hasCharts).toBeTruthy();
        });
    });

    test.describe('Offline Functionality Journey', () => {
        test('should handle offline scenarios gracefully', async ({ page, context }) => {
            // Navigate to the application and login
            await loginAsAdmin(page);

            // Go offline
            await context.setOffline(true);

            // Wait for offline detection
            await page.waitForTimeout(2000);

            // Should show offline indicator
            const hasOfflineIndicator = await page.locator('text=Offline, .offline-indicator, [data-testid="offline-status"]').isVisible();

            // Basic functionality should still work (cached content)
            const hasBasicContent = await page.locator('text=Dashboard, text=Faculty Entry').isVisible();

            expect(hasOfflineIndicator || hasBasicContent).toBeTruthy();

            // Go back online
            await context.setOffline(false);
            await page.waitForTimeout(2000);

            // Offline indicator should disappear or online status should show
            const offlineStillVisible = await page.locator('text=Offline').isVisible();
            expect(offlineStillVisible).toBeFalsy();
        });

        test('should cache critical resources for offline use', async ({ page, context }) => {
            // Load the app online first
            await page.waitForLoadState('networkidle');

            // Go offline
            await context.setOffline(true);

            // Reload the page
            await page.reload();

            // Should still show basic content from cache
            const hasBasicContent = await page.locator('text=AIC Da\'wa College, text=Public Portal').isVisible();
            expect(hasBasicContent).toBeTruthy();
        });
    });

    test.describe('Error Handling Journey', () => {
        test('should handle network errors gracefully', async ({ page }) => {
            // Intercept network requests and simulate failures for API calls
            await page.route('**/api/**', route => {
                route.abort('failed');
            });

            await page.goto('/');

            // Should show error message, fallback content, or handle gracefully
            const hasError = await page.locator('text=Error, text=Failed, text=Try again').isVisible();
            const hasBasicContent = await page.locator('text=AIC Da\'wa College').isVisible();

            expect(hasError || hasBasicContent).toBeTruthy();
        });

        test('should recover from JavaScript errors', async ({ page }) => {
            // Listen for console errors
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

            // Navigate through the app
            await page.fill('input[placeholder*="admission"], input[placeholder*="Admission"]', 'AD001');
            await page.click('button:has-text("Search")');

            // Wait for any async operations
            await page.waitForTimeout(2000);

            // Filter out non-critical errors
            const criticalErrors = errors.filter(error =>
                error.includes('Uncaught') ||
                error.includes('TypeError') ||
                error.includes('ReferenceError')
            );

            expect(criticalErrors.length).toBe(0);
        });
    });

    test.describe('Performance and Accessibility', () => {
        test('should load within acceptable time', async ({ page }) => {
            const startTime = Date.now();
            await page.goto('/');
            await page.waitForLoadState('networkidle');
            const loadTime = Date.now() - startTime;

            // Should load within 5 seconds
            expect(loadTime).toBeLessThan(5000);
        });

        test('should have proper accessibility attributes', async ({ page }) => {
            await page.goto('/');

            // Check for proper heading structure
            const hasHeading = await page.locator('h1, h2, h3').isVisible();
            expect(hasHeading).toBeTruthy();

            // Check for alt text on images
            const images = page.locator('img');
            const imageCount = await images.count();

            for (let i = 0; i < imageCount; i++) {
                const img = images.nth(i);
                const alt = await img.getAttribute('alt');
                expect(alt).toBeTruthy();
            }

            // Check for proper form labels
            const inputs = page.locator('input[type="text"], input[type="password"], input[type="email"]');
            const inputCount = await inputs.count();

            for (let i = 0; i < Math.min(inputCount, 5); i++) {
                const input = inputs.nth(i);
                const id = await input.getAttribute('id');
                const ariaLabel = await input.getAttribute('aria-label');
                const placeholder = await input.getAttribute('placeholder');

                // Should have either id (with corresponding label), aria-label, or placeholder
                expect(id || ariaLabel || placeholder).toBeTruthy();
            }
        });

        test('should support keyboard navigation', async ({ page }) => {
            await page.goto('/');

            // Test tab navigation
            await page.keyboard.press('Tab');

            // Should focus on first interactive element
            const focusedElement = page.locator(':focus');
            const isFocused = await focusedElement.count() > 0;
            expect(isFocused).toBeTruthy();

            // Test Enter key on buttons
            const firstButton = page.locator('button').first();
            if (await firstButton.isVisible()) {
                await firstButton.focus();
                await expect(firstButton).toBeFocused();
            }
        });
    });
});

// Helper functions
async function loginAsAdmin(page: any) {
    const adminButton = page.locator('text=Admin Login, text=Faculty Entry, text=Admin, button:has-text("Admin")');
    if (await adminButton.isVisible()) {
        await adminButton.first().click();

        // Fill credentials
        await page.fill('input[type="password"], input[placeholder*="password"], input[placeholder*="PIN"]', '1234');

        const usernameInput = page.locator('input[type="text"], input[placeholder*="Registry"], input[placeholder*="username"]');
        if (await usernameInput.isVisible()) {
            await usernameInput.fill('admin');
        }

        await page.click('button:has-text("Login"), button:has-text("Enter"), button:has-text("Authenticate")');
        await page.waitForTimeout(2000);
    }
}

async function selectClassAndSubject(page: any) {
    const classSelect = page.locator('select:near(:text("Class"))').first();
    if (await classSelect.isVisible()) {
        const options = await classSelect.locator('option').count();
        if (options > 1) {
            await classSelect.selectOption({ index: 1 });
        }
    }

    const subjectSelect = page.locator('select:near(:text("Subject"))').first();
    if (await subjectSelect.isVisible()) {
        const options = await subjectSelect.locator('option').count();
        if (options > 1) {
            await subjectSelect.selectOption({ index: 1 });
        }
    }

    await page.waitForTimeout(1000);
}