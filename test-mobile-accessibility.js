/**
 * Mobile Accessibility Testing Script
 * Tests the accessibility improvements implemented in Task 10.1
 */

// Test touch target sizes
function testTouchTargets() {
    console.log('🔍 Testing Touch Target Sizes...');

    const interactiveElements = document.querySelectorAll('button, input, select, [role="button"], [role="tab"]');
    const failedElements = [];

    interactiveElements.forEach((element, index) => {
        const rect = element.getBoundingClientRect();
        const minSize = 44; // WCAG minimum touch target size

        if (rect.width < minSize || rect.height < minSize) {
            failedElements.push({
                element: element.tagName.toLowerCase(),
                class: element.className,
                size: `${Math.round(rect.width)}x${Math.round(rect.height)}`,
                index
            });
        }
    });

    if (failedElements.length === 0) {
        console.log('✅ All touch targets meet 44px minimum requirement');
    } else {
        console.log(`❌ ${failedElements.length} elements fail touch target requirements:`);
        failedElements.forEach(el => {
            console.log(`   - ${el.element} (${el.size}px): ${el.class.substring(0, 50)}...`);
        });
    }

    return failedElements.length === 0;
}

// Test ARIA labels and attributes
function testARIALabels() {
    console.log('🔍 Testing ARIA Labels and Attributes...');

    const interactiveElements = document.querySelectorAll('button, input, select, [role="button"], [role="tab"]');
    const missingLabels = [];

    interactiveElements.forEach((element, index) => {
        const hasLabel = element.hasAttribute('aria-label') ||
            element.hasAttribute('aria-labelledby') ||
            element.hasAttribute('title') ||
            element.textContent.trim().length > 0;

        if (!hasLabel) {
            missingLabels.push({
                element: element.tagName.toLowerCase(),
                class: element.className,
                index
            });
        }
    });

    if (missingLabels.length === 0) {
        console.log('✅ All interactive elements have proper labels');
    } else {
        console.log(`❌ ${missingLabels.length} elements missing labels:`);
        missingLabels.forEach(el => {
            console.log(`   - ${el.element}: ${el.class.substring(0, 50)}...`);
        });
    }

    return missingLabels.length === 0;
}

// Test table accessibility
function testTableAccessibility() {
    console.log('🔍 Testing Table Accessibility...');

    const tables = document.querySelectorAll('table');
    let allTablesAccessible = true;

    tables.forEach((table, index) => {
        const hasRole = table.hasAttribute('role');
        const hasAriaLabel = table.hasAttribute('aria-label') || table.hasAttribute('aria-labelledby');
        const headers = table.querySelectorAll('th');
        const headersWithScope = table.querySelectorAll('th[scope]');

        console.log(`Table ${index + 1}:`);
        console.log(`   - Has role attribute: ${hasRole ? '✅' : '❌'}`);
        console.log(`   - Has aria-label: ${hasAriaLabel ? '✅' : '❌'}`);
        console.log(`   - Headers with scope: ${headersWithScope.length}/${headers.length}`);

        if (!hasRole || !hasAriaLabel || headersWithScope.length !== headers.length) {
            allTablesAccessible = false;
        }
    });

    if (allTablesAccessible && tables.length > 0) {
        console.log('✅ All tables have proper accessibility attributes');
    } else if (tables.length === 0) {
        console.log('ℹ️ No tables found on current page');
    }

    return allTablesAccessible;
}

// Test focus management
function testFocusManagement() {
    console.log('🔍 Testing Focus Management...');

    const focusableElements = document.querySelectorAll(
        'button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
    );

    let focusIssues = 0;

    focusableElements.forEach((element, index) => {
        // Test if element can receive focus
        element.focus();
        if (document.activeElement !== element) {
            console.log(`❌ Element cannot receive focus: ${element.tagName.toLowerCase()}`);
            focusIssues++;
        }
    });

    if (focusIssues === 0) {
        console.log(`✅ All ${focusableElements.length} focusable elements can receive focus`);
    } else {
        console.log(`❌ ${focusIssues} elements have focus issues`);
    }

    return focusIssues === 0;
}

// Test color contrast (basic check)
function testColorContrast() {
    console.log('🔍 Testing Color Contrast (Basic Check)...');

    // This is a simplified check - for comprehensive testing, use tools like axe-core
    const textElements = document.querySelectorAll('p, span, div, button, input, select, label, h1, h2, h3, h4, h5, h6');
    let lowContrastElements = 0;

    textElements.forEach(element => {
        const styles = window.getComputedStyle(element);
        const color = styles.color;
        const backgroundColor = styles.backgroundColor;

        // Skip elements with transparent backgrounds or default colors
        if (backgroundColor === 'rgba(0, 0, 0, 0)' || backgroundColor === 'transparent') {
            return;
        }

        // Basic check for very light text on light backgrounds (simplified)
        if (color.includes('rgb(255') && backgroundColor.includes('rgb(255')) {
            lowContrastElements++;
        }
    });

    if (lowContrastElements === 0) {
        console.log('✅ No obvious color contrast issues detected');
    } else {
        console.log(`⚠️ ${lowContrastElements} potential color contrast issues detected`);
        console.log('   Use tools like axe-core or WAVE for comprehensive contrast testing');
    }

    return lowContrastElements === 0;
}

// Test mobile-specific accessibility features
function testMobileAccessibility() {
    console.log('🔍 Testing Mobile-Specific Accessibility...');

    const viewport = document.querySelector('meta[name="viewport"]');
    const hasViewport = viewport && viewport.content.includes('width=device-width');

    const touchElements = document.querySelectorAll('[style*="minHeight"], [style*="minWidth"]');
    const hasTouchOptimization = touchElements.length > 0;

    const ariaLiveElements = document.querySelectorAll('[aria-live]');
    const hasLiveRegions = ariaLiveElements.length > 0;

    console.log(`   - Responsive viewport: ${hasViewport ? '✅' : '❌'}`);
    console.log(`   - Touch-optimized elements: ${hasTouchOptimization ? '✅' : '❌'}`);
    console.log(`   - Live regions for updates: ${hasLiveRegions ? '✅' : '❌'}`);

    return hasViewport && hasTouchOptimization;
}

// Run all accessibility tests
function runAccessibilityTests() {
    console.log('🚀 Starting Mobile Accessibility Tests...\n');

    const results = {
        touchTargets: testTouchTargets(),
        ariaLabels: testARIALabels(),
        tableAccessibility: testTableAccessibility(),
        focusManagement: testFocusManagement(),
        colorContrast: testColorContrast(),
        mobileAccessibility: testMobileAccessibility()
    };

    console.log('\n📊 Test Results Summary:');
    console.log('========================');

    const passedTests = Object.values(results).filter(result => result === true).length;
    const totalTests = Object.keys(results).length;

    Object.entries(results).forEach(([test, passed]) => {
        console.log(`${passed ? '✅' : '❌'} ${test.replace(/([A-Z])/g, ' $1').toLowerCase()}`);
    });

    console.log(`\n🎯 Overall Score: ${passedTests}/${totalTests} tests passed`);

    if (passedTests === totalTests) {
        console.log('🎉 All accessibility tests passed! Great job!');
    } else {
        console.log('⚠️ Some accessibility issues need attention. Check the details above.');
    }

    return results;
}

// Export for use in browser console or testing frameworks
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        runAccessibilityTests,
        testTouchTargets,
        testARIALabels,
        testTableAccessibility,
        testFocusManagement,
        testColorContrast,
        testMobileAccessibility
    };
}

// Auto-run if script is loaded directly in browser
if (typeof window !== 'undefined') {
    // Wait for DOM to be ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', runAccessibilityTests);
    } else {
        // DOM is already ready
        setTimeout(runAccessibilityTests, 1000); // Small delay to ensure all components are rendered
    }
}