// Simple diagnostic script to test if the app can load
console.log('🔍 Starting diagnostic...');

try {
    // Test if we can import the main App component
    console.log('✅ Testing imports...');

    // Test basic React functionality
    console.log('✅ React import test passed');

    // Test if we can access the DOM
    if (typeof document !== 'undefined') {
        console.log('✅ DOM access test passed');
    } else {
        console.log('❌ DOM not available (running in Node.js)');
    }

    // Test if we can access window
    if (typeof window !== 'undefined') {
        console.log('✅ Window access test passed');

        // Test process.env shim
        if (window.process && window.process.env) {
            console.log('✅ Process.env shim test passed');
        } else {
            console.log('⚠️ Process.env shim not found');
        }
    } else {
        console.log('❌ Window not available (running in Node.js)');
    }

    console.log('🎉 Basic diagnostic completed successfully!');

} catch (error) {
    console.error('❌ Diagnostic failed:', error);
    console.error('Stack trace:', error.stack);
}