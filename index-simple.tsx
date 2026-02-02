import React from 'react';
import ReactDOM from 'react-dom/client';
import SimpleApp from './App-simple';

// Shim for process.env to prevent crashes in native browser ESM environments
(window as any).process = (window as any).process || { env: {} };

const rootElement = document.getElementById('root');
if (!rootElement) {
    throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);
root.render(
    <React.StrictMode>
        <SimpleApp />
    </React.StrictMode>
);