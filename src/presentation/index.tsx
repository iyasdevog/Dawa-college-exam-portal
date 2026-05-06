
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

// Handle dynamic import failures (e.g., after a new deployment when chunks change)
window.addEventListener('vite:preloadError', () => {
  window.location.reload();
});

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);