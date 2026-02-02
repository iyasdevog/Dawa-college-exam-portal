import React from 'react';
import ReactDOM from 'react-dom/client';

console.log('🔍 Starting debug process...');

// Shim for process.env to prevent crashes in native browser ESM environments
(window as any).process = (window as any).process || { env: {} };
console.log('✅ Process shim added');

try {
    console.log('🔍 Importing DebugApp...');
    import('./debug-app').then((module) => {
        console.log('✅ DebugApp imported successfully');
        const DebugApp = module.default;

        const rootElement = document.getElementById('root');
        if (!rootElement) {
            throw new Error("Could not find root element to mount to");
        }
        console.log('✅ Root element found');

        const root = ReactDOM.createRoot(rootElement);
        console.log('✅ React root created');

        root.render(
            <React.StrictMode>
                <DebugApp />
            </React.StrictMode>
        );
        console.log('✅ App rendered successfully');

    }).catch((error) => {
        console.error('❌ Failed to import DebugApp:', error);
        document.body.innerHTML = `
      <div style="padding: 20px; font-family: Arial, sans-serif;">
        <h1 style="color: red;">❌ Import Error</h1>
        <p>Failed to import DebugApp: ${error.message}</p>
        <pre style="background: #f0f0f0; padding: 10px; overflow: auto;">${error.stack}</pre>
      </div>
    `;
    });

} catch (error) {
    console.error('❌ Critical error in index:', error);
    document.body.innerHTML = `
    <div style="padding: 20px; font-family: Arial, sans-serif;">
      <h1 style="color: red;">❌ Critical Error</h1>
      <p>Error: ${error.message}</p>
      <pre style="background: #f0f0f0; padding: 10px; overflow: auto;">${error.stack}</pre>
    </div>
  `;
}