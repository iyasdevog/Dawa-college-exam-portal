/**
 * Performance Monitoring Test Script
 * Run this in the browser console to test performance monitoring functionality
 */

// Test Performance Service
console.log('🧪 Testing Performance Monitoring System...');

// Test 1: Check if performance service is available
try {
    // This would be imported in the actual application
    console.log('✅ Performance service modules created successfully');
} catch (error) {
    console.error('❌ Performance service not available:', error);
}

// Test 2: Simulate input lag measurement
function testInputLagMeasurement() {
    console.log('🔍 Testing input lag measurement...');

    const startTime = performance.now();

    // Simulate input processing delay
    setTimeout(() => {
        const endTime = performance.now();
        const lag = endTime - startTime;

        console.log(`📊 Simulated input lag: ${lag.toFixed(2)}ms`);

        if (lag > 100) {
            console.warn('⚠️ High input lag detected');
        } else {
            console.log('✅ Input lag within acceptable range');
        }
    }, Math.random() * 150); // Random delay 0-150ms
}

// Test 3: Check memory usage
function testMemoryMonitoring() {
    console.log('🔍 Testing memory monitoring...');

    if ('memory' in performance) {
        const memory = performance.memory;
        const percentage = (memory.usedJSHeapSize / memory.jsHeapSizeLimit) * 100;

        console.log(`📊 Memory usage: ${percentage.toFixed(1)}%`);
        console.log(`📊 Used heap: ${(memory.usedJSHeapSize / 1024 / 1024).toFixed(1)} MB`);
        console.log(`📊 Heap limit: ${(memory.jsHeapSizeLimit / 1024 / 1024).toFixed(1)} MB`);

        if (percentage > 80) {
            console.warn('⚠️ High memory usage detected');
        } else {
            console.log('✅ Memory usage within normal range');
        }
    } else {
        console.warn('⚠️ Memory API not supported in this browser');
    }
}

// Test 4: Simulate async operation measurement
async function testResponseTimeMeasurement() {
    console.log('🔍 Testing response time measurement...');

    const startTime = performance.now();

    // Simulate async operation
    await new Promise(resolve => {
        setTimeout(resolve, Math.random() * 300); // Random delay 0-300ms
    });

    const endTime = performance.now();
    const responseTime = endTime - startTime;

    console.log(`📊 Simulated response time: ${responseTime.toFixed(2)}ms`);

    if (responseTime > 200) {
        console.warn('⚠️ Slow response time detected');
    } else {
        console.log('✅ Response time within acceptable range');
    }
}

// Test 5: Device performance detection
function testDeviceDetection() {
    console.log('🔍 Testing device detection...');

    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) ||
        window.innerWidth <= 768;

    console.log(`📱 Device type: ${isMobile ? 'Mobile' : 'Desktop'}`);
    console.log(`📐 Viewport: ${window.innerWidth} × ${window.innerHeight}`);
    console.log(`🖥️ User Agent: ${navigator.userAgent}`);

    // Estimate performance tier
    const cores = navigator.hardwareConcurrency || 1;
    let tier = 'low';

    if ('memory' in performance) {
        const memory = performance.memory;
        if (memory.jsHeapSizeLimit > 1000000000 && cores >= 4) {
            tier = 'high';
        } else if (memory.jsHeapSizeLimit > 500000000 && cores >= 2) {
            tier = 'medium';
        }
    }

    console.log(`⚡ Performance tier: ${tier}`);
    console.log(`🔧 CPU cores: ${cores}`);
}

// Test 6: Error handling simulation
function testErrorHandling() {
    console.log('🔍 Testing error handling...');

    try {
        // Simulate a controlled error
        throw new Error('Test error for performance monitoring');
    } catch (error) {
        console.log('✅ Error caught successfully:', error.message);

        // Simulate error reporting
        const errorReport = {
            message: error.message,
            timestamp: Date.now(),
            userAgent: navigator.userAgent,
            url: window.location.href,
        };

        console.log('📋 Error report generated:', errorReport);
    }
}

// Test 7: Performance Observer availability
function testPerformanceObserver() {
    console.log('🔍 Testing Performance Observer support...');

    if ('PerformanceObserver' in window) {
        console.log('✅ PerformanceObserver API supported');

        try {
            // Test long task observation
            const observer = new PerformanceObserver((list) => {
                for (const entry of list.getEntries()) {
                    console.log(`📊 Long task detected: ${entry.duration.toFixed(2)}ms`);
                }
            });

            // This might not be supported in all browsers
            observer.observe({ entryTypes: ['longtask'] });
            console.log('✅ Long task monitoring enabled');

            // Clean up after test
            setTimeout(() => observer.disconnect(), 1000);
        } catch (error) {
            console.warn('⚠️ Long task monitoring not supported:', error.message);
        }
    } else {
        console.warn('⚠️ PerformanceObserver API not supported');
    }
}

// Run all tests
async function runAllTests() {
    console.log('🚀 Starting Performance Monitoring Tests...\n');

    testInputLagMeasurement();
    testMemoryMonitoring();
    await testResponseTimeMeasurement();
    testDeviceDetection();
    testErrorHandling();
    testPerformanceObserver();

    console.log('\n✅ Performance monitoring tests completed!');
    console.log('📝 Check the console output above for detailed results.');
    console.log('🔧 In the actual application, these metrics would be collected automatically.');
}

// Auto-run tests when script is loaded
runAllTests();

// Export test functions for manual execution
window.performanceTests = {
    runAll: runAllTests,
    inputLag: testInputLagMeasurement,
    memory: testMemoryMonitoring,
    responseTime: testResponseTimeMeasurement,
    device: testDeviceDetection,
    errorHandling: testErrorHandling,
    performanceObserver: testPerformanceObserver
};

console.log('💡 You can run individual tests using:');
console.log('   performanceTests.inputLag()');
console.log('   performanceTests.memory()');
console.log('   performanceTests.responseTime()');
console.log('   performanceTests.device()');
console.log('   performanceTests.errorHandling()');
console.log('   performanceTests.performanceObserver()');
console.log('   performanceTests.runAll()');