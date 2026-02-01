/** @type {import('jest').Config} */
module.exports = {
    preset: 'ts-jest',
    testEnvironment: 'jsdom',
    roots: ['<rootDir>/src', '<rootDir>/tests'],
    testMatch: [
        '**/__tests__/**/*.{ts,tsx}',
        '**/*.(test|spec).{ts,tsx}',
        '**/tests/unit/**/*.{ts,tsx}',
        '**/tests/integration/**/*.{ts,tsx}',
        '**/tests/properties/**/*.{ts,tsx}'
    ],
    testPathIgnorePatterns: [
        '/node_modules/',
        '/tests/e2e/',
        '/tests/accessibility/',
        '/tests/performance/',
        '/tests/security/'
    ],
    transform: {
        '^.+\\.(ts|tsx)$': 'ts-jest',
    },
    collectCoverageFrom: [
        'src/**/*.{ts,tsx}',
        '!src/**/*.d.ts',
        '!src/**/__tests__/**',
        '!src/**/index.ts',
        '!src/setupTests.ts'
    ],
    coverageThreshold: {
        global: {
            branches: 80,
            functions: 80,
            lines: 80,
            statements: 80
        }
    },
    moduleNameMapper: {
        '^@/(.*)$': '<rootDir>/$1',
        '\\.(css|less|scss|sass)$': 'identity-obj-proxy'
    },
    setupFilesAfterEnv: ['<rootDir>/src/setupTests.ts'],
    testTimeout: 10000,
    maxWorkers: '50%'
};