// Test Script for Offline Functionality
// Run this in the browser console to test offline capabilities

console.log('🧪 Testing Offline Functionality for AIC Da\'wa College Exam Portal');

// Test 1: Service Worker Registration
async function testServiceWorkerRegistration() {
    console.log('\n📋 Test 1: Service Worker Registration');

    if ('serviceWorker' in navigator) {
        try {
            const registration = await navigator.serviceWorker.getRegistration();
            if (registration) {
                console.log('✅ Service Worker is registered');
                console.log('   Scope:', registration.scope);
                console.log('   State:', registration.active?.state);
                return true;
            } else {
                console.log('❌ Service Worker not registered');
                return false;
            }
        } catch (error) {
            console.log('❌ Service Worker registration check failed:', error);
            return false;
        }
    } else {
        console.log('❌ Service Worker not supported');
        return false;
    }
}

// Test 2: IndexedDB Availability
async function testIndexedDBAvailability() {
    console.log('\n📋 Test 2: IndexedDB Availability');

    if ('indexedDB' in window) {
        try {
            // Try to open a test database
            const request = indexedDB.open('TestDB', 1);

            return new Promise((resolve) => {
                request.onsuccess = () => {
                    console.log('✅ IndexedDB is available');
                    request.result.close();
                    indexedDB.deleteDatabase('TestDB');
                    resolve(true);
                };

                request.onerror = () => {
                    console.log('❌ IndexedDB error:', request.error);
                    resolve(false);
                };

                request.onblocked = () => {
                    console.log('⚠️ IndexedDB blocked');
                    resolve(false);
                };
            });
        } catch (error) {
            console.log('❌ IndexedDB test failed:', error);
            return false;
        }
    } else {
        console.log('❌ IndexedDB not supported');
        return false;
    }
}

// Test 3: LocalStorage Availability
function testLocalStorageAvailability() {
    console.log('\n📋 Test 3: LocalStorage Availability');

    try {
        const testKey = 'offline_test_key';
        const testValue = 'offline_test_value';

        localStorage.setItem(testKey, testValue);
        const retrieved = localStorage.getItem(testKey);
        localStorage.removeItem(testKey);

        if (retrieved === testValue) {
            console.log('✅ LocalStorage is available');
            return true;
        } else {
            console.log('❌ LocalStorage read/write failed');
            return false;
        }
    } catch (error) {
        console.log('❌ LocalStorage test failed:', error);
        return false;
    }
}

// Test 4: Online/Offline Detection
function testOnlineOfflineDetection() {
    console.log('\n📋 Test 4: Online/Offline Detection');

    console.log('   Current status:', navigator.onLine ? 'Online' : 'Offline');

    // Test event listeners
    let onlineEventFired = false;
    let offlineEventFired = false;

    const onlineHandler = () => {
        onlineEventFired = true;
        console.log('   📡 Online event detected');
    };

    const offlineHandler = () => {
        offlineEventFired = true;
        console.log('   📡 Offline event detected');
    };

    window.addEventListener('online', onlineHandler);
    window.addEventListener('offline', offlineHandler);

    console.log('✅ Online/Offline event listeners registered');
    console.log('   💡 Try disconnecting/reconnecting your network to test events');

    // Cleanup after 30 seconds
    setTimeout(() => {
        window.removeEventListener('online', onlineHandler);
        window.removeEventListener('offline', offlineHandler);
        console.log('   🧹 Event listeners cleaned up');
    }, 30000);

    return true;
}

// Test 5: Cache API Availability
async function testCacheAPIAvailability() {
    console.log('\n📋 Test 5: Cache API Availability');

    if ('caches' in window) {
        try {
            const testCacheName = 'offline-test-cache';
            const cache = await caches.open(testCacheName);

            // Test cache operations
            const testUrl = window.location.origin + '/test-cache-entry';
            const testResponse = new Response('test cache content');

            await cache.put(testUrl, testResponse);
            const cachedResponse = await cache.match(testUrl);

            if (cachedResponse) {
                console.log('✅ Cache API is working');
                await caches.delete(testCacheName);
                return true;
            } else {
                console.log('❌ Cache API read failed');
                return false;
            }
        } catch (error) {
            console.log('❌ Cache API test failed:', error);
            return false;
        }
    } else {
        console.log('❌ Cache API not supported');
        return false;
    }
}

// Test 6: Background Sync Support
function testBackgroundSyncSupport() {
    console.log('\n📋 Test 6: Background Sync Support');

    if ('serviceWorker' in navigator && 'sync' in window.ServiceWorkerRegistration.prototype) {
        console.log('✅ Background Sync is supported');
        return true;
    } else {
        console.log('❌ Background Sync not supported');
        console.log('   💡 Fallback to manual sync will be used');
        return false;
    }
}

// Test 7: Offline Storage Service
async function testOfflineStorageService() {
    console.log('\n📋 Test 7: Offline Storage Service');

    try {
        // Check if the offline storage service is available
        if (window.offlineStorageService) {
            console.log('✅ Offline Storage Service is loaded');

            // Test basic operations
            const status = await window.offlineStorageService.getOfflineStatus();
            console.log('   Status:', status);

            return true;
        } else {
            console.log('❌ Offline Storage Service not found');
            console.log('   💡 Make sure you\'re on the Faculty Entry page');
            return false;
        }
    } catch (error) {
        console.log('❌ Offline Storage Service test failed:', error);
        return false;
    }
}

// Test 8: PWA Manifest
async function testPWAManifest() {
    console.log('\n📋 Test 8: PWA Manifest');

    try {
        const response = await fetch('/manifest.json');
        if (response.ok) {
            const manifest = await response.json();
            console.log('✅ PWA Manifest is available');
            console.log('   App Name:', manifest.name);
            console.log('   Display Mode:', manifest.display);
            return true;
        } else {
            console.log('❌ PWA Manifest not found');
            return false;
        }
    } catch (error) {
        console.log('❌ PWA Manifest test failed:', error);
        return false;
    }
}

// Run all tests
async function runAllTests() {
    console.log('🚀 Starting Offline Functionality Tests...\n');

    const results = {
        serviceWorker: await testServiceWorkerRegistration(),
        indexedDB: await testIndexedDBAvailability(),
        localStorage: testLocalStorageAvailability(),
        onlineDetection: testOnlineOfflineDetection(),
        cacheAPI: await testCacheAPIAvailability(),
        backgroundSync: testBackgroundSyncSupport(),
        offlineStorage: await testOfflineStorageService(),
        pwaManifest: await testPWAManifest()
    };

    console.log('\n📊 Test Results Summary:');
    console.log('========================');

    let passedTests = 0;
    let totalTests = 0;

    for (const [testName, result] of Object.entries(results)) {
        totalTests++;
        if (result) passedTests++;

        const status = result ? '✅ PASS' : '❌ FAIL';
        const formattedName = testName.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase());
        console.log(`${status} ${formattedName}`);
    }

    console.log('========================');
    console.log(`📈 Overall: ${passedTests}/${totalTests} tests passed (${Math.round(passedTests / totalTests * 100)}%)`);

    if (passedTests === totalTests) {
        console.log('🎉 All tests passed! Offline functionality is ready.');
    } else if (passedTests >= totalTests * 0.75) {
        console.log('⚠️ Most tests passed. Some features may have limited functionality.');
    } else {
        console.log('❌ Several tests failed. Offline functionality may not work properly.');
    }

    console.log('\n💡 Manual Testing Suggestions:');
    console.log('1. Navigate to Faculty Entry page');
    console.log('2. Start entering marks for a student');
    console.log('3. Disconnect your internet connection');
    console.log('4. Continue entering marks (should work offline)');
    console.log('5. Reconnect internet (should auto-sync)');
    console.log('6. Check offline status indicator in the UI');
    console.log('7. Try the draft recovery feature');

    return results;
}

// Auto-run tests
runAllTests().catch(error => {
    console.error('❌ Test execution failed:', error);
});

// Export for manual testing
window.offlineTests = {
    runAllTests,
    testServiceWorkerRegistration,
    testIndexedDBAvailability,
    testLocalStorageAvailability,
    testOnlineOfflineDetection,
    testCacheAPIAvailability,
    testBackgroundSyncSupport,
    testOfflineStorageService,
    testPWAManifest
};

console.log('\n💡 Individual tests available as window.offlineTests.*');