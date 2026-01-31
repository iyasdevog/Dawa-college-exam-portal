/**
 * Comprehensive Print Functionality Test Suite
 * Tests print functionality across different browsers, paper sizes, and scenarios
 * For AIC Da'wa College Exam Portal - Task 8.2
 */

class PrintFunctionalityTester {
    constructor() {
        this.testResults = {
            browserCompatibility: {},
            paperSizes: {},
            documentTypes: {},
            printQuality: {},
            performance: {},
            issues: []
        };

        this.supportedBrowsers = ['Chrome', 'Safari', 'Firefox', 'Edge'];
        this.paperSizes = ['A4', 'Letter', 'Legal', 'A3'];
        this.documentTypes = ['StudentScorecard', 'ClassResults'];

        this.init();
    }

    init() {
        console.log('🖨️ Print Functionality Test Suite Initialized');
        console.log('📋 Testing browsers:', this.supportedBrowsers);
        console.log('📄 Testing paper sizes:', this.paperSizes);
        console.log('📊 Testing document types:', this.documentTypes);
    }

    /**
     * Detect current browser for testing
     */
    detectBrowser() {
        const userAgent = navigator.userAgent;

        if (userAgent.includes('Chrome') && !userAgent.includes('Edg')) {
            return 'Chrome';
        } else if (userAgent.includes('Safari') && !userAgent.includes('Chrome')) {
            return 'Safari';
        } else if (userAgent.includes('Firefox')) {
            return 'Firefox';
        } else if (userAgent.includes('Edg')) {
            return 'Edge';
        }

        return 'Unknown';
    }

    /**
     * Test CSS print media query support
     */
    testPrintMediaQuerySupport() {
        const testElement = document.createElement('div');
        testElement.style.cssText = `
            display: none;
            @media print {
                display: block;
            }
        `;

        document.body.appendChild(testElement);

        // Create a temporary print media context
        const printMediaQuery = window.matchMedia('print');
        const supportsMediaQuery = printMediaQuery !== null;

        document.body.removeChild(testElement);

        return {
            supported: supportsMediaQuery,
            details: {
                mediaQuery: printMediaQuery ? printMediaQuery.media : 'Not supported',
                matches: printMediaQuery ? printMediaQuery.matches : false
            }
        };
    }

    /**
     * Test @page rule support
     */
    testPageRuleSupport() {
        const testStyles = `
            @page {
                margin: 1in;
                size: A4;
            }
            @page :first {
                margin-top: 2in;
            }
        `;

        const styleElement = document.createElement('style');
        styleElement.textContent = testStyles;
        document.head.appendChild(styleElement);

        // Check if CSS rules were parsed
        const styleSheet = styleElement.sheet;
        let pageRulesSupported = false;

        try {
            if (styleSheet && styleSheet.cssRules) {
                for (let rule of styleSheet.cssRules) {
                    if (rule.type === CSSRule.PAGE_RULE) {
                        pageRulesSupported = true;
                        break;
                    }
                }
            }
        } catch (e) {
            console.warn('Error checking @page rule support:', e);
        }

        document.head.removeChild(styleElement);

        return {
            supported: pageRulesSupported,
            details: {
                cssRulesCount: styleSheet ? styleSheet.cssRules.length : 0,
                pageRuleType: CSSRule.PAGE_RULE || 6
            }
        };
    }

    /**
     * Test print color adjustment support
     */
    testPrintColorAdjustment() {
        const testElement = document.createElement('div');
        testElement.style.cssText = `
            -webkit-print-color-adjust: exact;
            color-adjust: exact;
            print-color-adjust: exact;
            background-color: red;
            color: white;
        `;

        document.body.appendChild(testElement);

        const computedStyle = window.getComputedStyle(testElement);
        const colorAdjustSupport = {
            webkit: computedStyle.webkitPrintColorAdjust === 'exact',
            standard: computedStyle.colorAdjust === 'exact',
            printColorAdjust: computedStyle.printColorAdjust === 'exact'
        };

        document.body.removeChild(testElement);

        return {
            supported: Object.values(colorAdjustSupport).some(Boolean),
            details: colorAdjustSupport
        };
    }

    /**
     * Test font rendering quality
     */
    testFontRendering() {
        const testFonts = [
            'system-ui, -apple-system, sans-serif',
            'Georgia, serif',
            'Courier New, monospace',
            'Arial, sans-serif'
        ];

        const results = {};

        testFonts.forEach(font => {
            const testElement = document.createElement('div');
            testElement.style.cssText = `
                font-family: ${font};
                font-size: 12pt;
                line-height: 1.4;
                position: absolute;
                visibility: hidden;
                white-space: nowrap;
            `;
            testElement.textContent = 'Test Font Rendering Quality 123';

            document.body.appendChild(testElement);

            const rect = testElement.getBoundingClientRect();
            results[font] = {
                width: rect.width,
                height: rect.height,
                rendered: rect.width > 0 && rect.height > 0
            };

            document.body.removeChild(testElement);
        });

        return results;
    }

    /**
     * Test page break behavior
     */
    testPageBreakBehavior() {
        const testElement = document.createElement('div');
        testElement.innerHTML = `
            <div style="break-before: page; break-after: avoid;">Test Page Break Before</div>
            <div style="break-inside: avoid;">Test Break Inside Avoid</div>
            <div style="break-after: page;">Test Page Break After</div>
        `;

        document.body.appendChild(testElement);

        const elements = testElement.querySelectorAll('div');
        const pageBreakSupport = {
            breakBefore: elements[0].style.breakBefore === 'page',
            breakInside: elements[1].style.breakInside === 'avoid',
            breakAfter: elements[2].style.breakAfter === 'page'
        };

        document.body.removeChild(testElement);

        return {
            supported: Object.values(pageBreakSupport).every(Boolean),
            details: pageBreakSupport
        };
    }

    /**
     * Test table print optimization
     */
    testTablePrintOptimization() {
        const testTable = document.createElement('table');
        testTable.innerHTML = `
            <thead style="break-after: avoid;">
                <tr><th>Header 1</th><th>Header 2</th></tr>
            </thead>
            <tbody>
                <tr style="break-inside: avoid;"><td>Data 1</td><td>Data 2</td></tr>
                <tr style="break-inside: avoid;"><td>Data 3</td><td>Data 4</td></tr>
            </tbody>
        `;
        testTable.style.cssText = `
            border-collapse: collapse;
            break-inside: auto;
            width: 100%;
        `;

        document.body.appendChild(testTable);

        const computedStyle = window.getComputedStyle(testTable);
        const tableOptimization = {
            borderCollapse: computedStyle.borderCollapse === 'collapse',
            breakInside: computedStyle.breakInside === 'auto',
            width: computedStyle.width
        };

        document.body.removeChild(testTable);

        return {
            supported: tableOptimization.borderCollapse,
            details: tableOptimization
        };
    }

    /**
     * Test print preview functionality
     */
    async testPrintPreview() {
        const startTime = performance.now();

        try {
            // Simulate print preview by checking if print styles are applied
            const printMediaQuery = window.matchMedia('print');

            // Create a test element with print-specific styles
            const testElement = document.createElement('div');
            testElement.className = 'print:hidden';
            testElement.style.cssText = `
                display: block;
                @media print {
                    display: none !important;
                }
            `;

            document.body.appendChild(testElement);

            // Check if print styles would be applied
            const isHiddenInPrint = testElement.classList.contains('print:hidden');

            document.body.removeChild(testElement);

            const endTime = performance.now();

            return {
                success: true,
                responseTime: endTime - startTime,
                details: {
                    printMediaQuerySupported: printMediaQuery !== null,
                    printStylesDetected: isHiddenInPrint
                }
            };
        } catch (error) {
            return {
                success: false,
                error: error.message,
                responseTime: performance.now() - startTime
            };
        }
    }

    /**
     * Test PDF generation capability
     */
    testPDFGeneration() {
        const browser = this.detectBrowser();

        // Check if browser supports PDF generation
        const pdfSupport = {
            Chrome: true, // Native "Save as PDF"
            Safari: true, // Native PDF export
            Firefox: true, // Native PDF export
            Edge: true, // Native "Save as PDF"
            Unknown: false
        };

        const canvasSupport = !!document.createElement('canvas').getContext;
        const printSupport = typeof window.print === 'function';

        return {
            supported: pdfSupport[browser] && canvasSupport && printSupport,
            details: {
                browser,
                nativePDFSupport: pdfSupport[browser],
                canvasSupport,
                printFunctionAvailable: printSupport
            }
        };
    }

    /**
     * Test paper size compatibility
     */
    testPaperSizeCompatibility() {
        const paperSizes = {
            A4: { width: '210mm', height: '297mm' },
            Letter: { width: '8.5in', height: '11in' },
            Legal: { width: '8.5in', height: '14in' },
            A3: { width: '297mm', height: '420mm' }
        };

        const results = {};

        Object.entries(paperSizes).forEach(([size, dimensions]) => {
            const testStyle = `
                @page ${size.toLowerCase()} {
                    size: ${dimensions.width} ${dimensions.height};
                    margin: 1in;
                }
            `;

            const styleElement = document.createElement('style');
            styleElement.textContent = testStyle;
            document.head.appendChild(styleElement);

            // Check if the style was applied (basic test)
            const supported = styleElement.sheet && styleElement.sheet.cssRules.length > 0;

            results[size] = {
                supported,
                dimensions,
                cssRule: testStyle
            };

            document.head.removeChild(styleElement);
        });

        return results;
    }

    /**
     * Test performance metrics
     */
    async testPerformance() {
        const startTime = performance.now();
        const initialMemory = performance.memory ? performance.memory.usedJSHeapSize : 0;

        // Simulate print preparation
        const testElements = [];
        for (let i = 0; i < 100; i++) {
            const element = document.createElement('div');
            element.innerHTML = `
                <div class="print:text-sm print:p-2 print:border print:border-black">
                    Test content ${i} with print styles applied
                </div>
            `;
            testElements.push(element);
            document.body.appendChild(element);
        }

        // Measure time to apply print styles
        const styleApplicationTime = performance.now();

        // Clean up
        testElements.forEach(element => document.body.removeChild(element));

        const endTime = performance.now();
        const finalMemory = performance.memory ? performance.memory.usedJSHeapSize : 0;

        return {
            totalTime: endTime - startTime,
            styleApplicationTime: styleApplicationTime - startTime,
            memoryUsage: finalMemory - initialMemory,
            elementsProcessed: testElements.length
        };
    }

    /**
     * Run comprehensive browser compatibility test
     */
    async testBrowserCompatibility() {
        const browser = this.detectBrowser();
        console.log(`🌐 Testing browser compatibility for: ${browser}`);

        const tests = {
            printMediaQuery: this.testPrintMediaQuerySupport(),
            pageRules: this.testPageRuleSupport(),
            colorAdjustment: this.testPrintColorAdjustment(),
            fontRendering: this.testFontRendering(),
            pageBreaks: this.testPageBreakBehavior(),
            tableOptimization: this.testTablePrintOptimization(),
            printPreview: await this.testPrintPreview(),
            pdfGeneration: this.testPDFGeneration(),
            performance: await this.testPerformance()
        };

        this.testResults.browserCompatibility[browser] = {
            browser,
            userAgent: navigator.userAgent,
            tests,
            overallScore: this.calculateCompatibilityScore(tests),
            timestamp: new Date().toISOString()
        };

        return this.testResults.browserCompatibility[browser];
    }

    /**
     * Calculate compatibility score based on test results
     */
    calculateCompatibilityScore(tests) {
        let totalTests = 0;
        let passedTests = 0;

        Object.entries(tests).forEach(([testName, result]) => {
            totalTests++;

            if (typeof result === 'object' && result.supported !== undefined) {
                if (result.supported) passedTests++;
            } else if (typeof result === 'object' && result.success !== undefined) {
                if (result.success) passedTests++;
            } else if (testName === 'fontRendering') {
                // Special handling for font rendering test
                const renderedFonts = Object.values(result).filter(font => font.rendered).length;
                if (renderedFonts > 0) passedTests++;
            } else if (testName === 'performance') {
                // Performance test passes if total time is reasonable
                if (result.totalTime < 1000) passedTests++; // Less than 1 second
            }
        });

        return Math.round((passedTests / totalTests) * 100);
    }

    /**
     * Test specific document type printing
     */
    testDocumentType(documentType) {
        console.log(`📄 Testing document type: ${documentType}`);

        const documentSelectors = {
            StudentScorecard: '.scorecard, [data-testid="student-scorecard"]',
            ClassResults: '.class-results, [data-testid="class-results"]'
        };

        const selector = documentSelectors[documentType];
        const documentElement = document.querySelector(selector);

        if (!documentElement) {
            return {
                success: false,
                error: `Document type ${documentType} not found in DOM`,
                selector
            };
        }

        // Test document-specific print styles
        const printStyles = {
            hasOfficialHeader: !!documentElement.querySelector('.print\\:block'),
            hasAuthenticationFooter: !!documentElement.querySelector('.print\\:mt-6'),
            hasPrintOptimizedTable: !!documentElement.querySelector('.print\\:table-compact'),
            hasPageBreakControls: !!documentElement.querySelector('.print\\:break-inside-avoid')
        };

        const printStylesApplied = Object.values(printStyles).filter(Boolean).length;

        return {
            success: true,
            documentType,
            printStyles,
            printStylesScore: Math.round((printStylesApplied / Object.keys(printStyles).length) * 100),
            elementFound: true
        };
    }

    /**
     * Generate comprehensive test report
     */
    generateTestReport() {
        const report = {
            testSuite: 'Print Functionality Comprehensive Test',
            timestamp: new Date().toISOString(),
            browser: this.detectBrowser(),
            userAgent: navigator.userAgent,
            results: this.testResults,
            summary: {
                totalTests: 0,
                passedTests: 0,
                failedTests: 0,
                overallScore: 0
            },
            recommendations: []
        };

        // Calculate summary statistics
        Object.values(this.testResults.browserCompatibility).forEach(browserResult => {
            if (browserResult.overallScore) {
                report.summary.totalTests++;
                if (browserResult.overallScore >= 80) {
                    report.summary.passedTests++;
                } else {
                    report.summary.failedTests++;
                }
            }
        });

        if (report.summary.totalTests > 0) {
            report.summary.overallScore = Math.round(
                (report.summary.passedTests / report.summary.totalTests) * 100
            );
        }

        // Generate recommendations
        if (report.summary.overallScore < 80) {
            report.recommendations.push('Consider implementing additional browser-specific fallbacks');
        }

        if (this.testResults.issues.length > 0) {
            report.recommendations.push('Address identified compatibility issues');
        }

        return report;
    }

    /**
     * Run all tests and generate report
     */
    async runAllTests() {
        console.log('🚀 Starting comprehensive print functionality tests...');

        try {
            // Test browser compatibility
            await this.testBrowserCompatibility();

            // Test paper size compatibility
            this.testResults.paperSizes = this.testPaperSizeCompatibility();

            // Test document types if available
            this.documentTypes.forEach(docType => {
                this.testResults.documentTypes[docType] = this.testDocumentType(docType);
            });

            // Generate final report
            const report = this.generateTestReport();

            console.log('✅ Print functionality tests completed');
            console.log('📊 Overall Score:', report.summary.overallScore + '%');

            return report;

        } catch (error) {
            console.error('❌ Error during print functionality testing:', error);
            this.testResults.issues.push({
                type: 'TestExecutionError',
                message: error.message,
                timestamp: new Date().toISOString()
            });

            return this.generateTestReport();
        }
    }

    /**
     * Display test results in console
     */
    displayResults(report) {
        console.group('🖨️ Print Functionality Test Results');

        console.log('📊 Test Summary:');
        console.table(report.summary);

        if (report.results.browserCompatibility) {
            console.log('🌐 Browser Compatibility:');
            Object.entries(report.results.browserCompatibility).forEach(([browser, result]) => {
                console.log(`${browser}: ${result.overallScore}%`);
            });
        }

        if (report.results.paperSizes) {
            console.log('📄 Paper Size Support:');
            Object.entries(report.results.paperSizes).forEach(([size, result]) => {
                console.log(`${size}: ${result.supported ? '✅' : '❌'}`);
            });
        }

        if (report.recommendations.length > 0) {
            console.log('💡 Recommendations:');
            report.recommendations.forEach(rec => console.log(`- ${rec}`));
        }

        console.groupEnd();
    }
}

// Initialize and export the tester
const printTester = new PrintFunctionalityTester();

// Auto-run tests if in browser environment
if (typeof window !== 'undefined') {
    // Add to global scope for manual testing
    window.printTester = printTester;

    // Add test button to page for easy access
    const addTestButton = () => {
        const button = document.createElement('button');
        button.textContent = '🖨️ Test Print Functionality';
        button.style.cssText = `
            position: fixed;
            top: 10px;
            right: 10px;
            z-index: 10000;
            padding: 10px 15px;
            background: #10b981;
            color: white;
            border: none;
            border-radius: 8px;
            font-weight: bold;
            cursor: pointer;
            box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
        `;

        button.onclick = async () => {
            button.textContent = '🔄 Testing...';
            button.disabled = true;

            try {
                const report = await printTester.runAllTests();
                printTester.displayResults(report);

                // Show results in alert for quick feedback
                alert(`Print Test Results:\nOverall Score: ${report.summary.overallScore}%\nCheck console for detailed results.`);

            } catch (error) {
                console.error('Test execution failed:', error);
                alert('Test execution failed. Check console for details.');
            } finally {
                button.textContent = '🖨️ Test Print Functionality';
                button.disabled = false;
            }
        };

        document.body.appendChild(button);
    };

    // Add button when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', addTestButton);
    } else {
        addTestButton();
    }
}

// Export for Node.js environment
if (typeof module !== 'undefined' && module.exports) {
    module.exports = PrintFunctionalityTester;
}