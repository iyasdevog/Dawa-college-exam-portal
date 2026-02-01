/**
 * Jest setup file for comprehensive testing
 */
import '@testing-library/jest-dom';

// Mock global objects that might not be available in test environment
Object.defineProperty(global, 'performance', {
    value: {
        now: jest.fn(() => Date.now()),
        getEntriesByType: jest.fn(() => []),
        memory: {
            usedJSHeapSize: 50 * 1024 * 1024 // 50MB
        }
    },
    writable: true
});

Object.defineProperty(global, 'PerformanceObserver', {
    value: jest.fn().mockImplementation(() => ({
        observe: jest.fn(),
        disconnect: jest.fn()
    })),
    writable: true
});

// Mock IntersectionObserver for mobile components
Object.defineProperty(global, 'IntersectionObserver', {
    value: jest.fn().mockImplementation(() => ({
        observe: jest.fn(),
        unobserve: jest.fn(),
        disconnect: jest.fn()
    })),
    writable: true
});

// Mock ResizeObserver for responsive components
Object.defineProperty(global, 'ResizeObserver', {
    value: jest.fn().mockImplementation(() => ({
        observe: jest.fn(),
        unobserve: jest.fn(),
        disconnect: jest.fn()
    })),
    writable: true
});

// Extend existing window object instead of redefining
if (typeof window !== 'undefined') {
    Object.assign(window, {
        requestAnimationFrame: jest.fn(),
        localStorage: {
            getItem: jest.fn(),
            setItem: jest.fn(),
            removeItem: jest.fn(),
            clear: jest.fn()
        },
        sessionStorage: {
            getItem: jest.fn(),
            setItem: jest.fn(),
            removeItem: jest.fn(),
            clear: jest.fn()
        },
        matchMedia: jest.fn().mockImplementation(query => ({
            matches: false,
            media: query,
            onchange: null,
            addListener: jest.fn(),
            removeListener: jest.fn(),
            addEventListener: jest.fn(),
            removeEventListener: jest.fn(),
            dispatchEvent: jest.fn(),
        }))
    });
}

// Mock console methods to avoid noise in tests
global.console = {
    ...console,
    log: jest.fn(),
    warn: jest.fn(),
    error: jest.fn()
};