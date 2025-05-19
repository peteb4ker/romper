export default {
    preset: 'ts-jest', // Use ts-jest for TypeScript support
    testEnvironment: 'jest-environment-jsdom', // Use jsdom for DOM-related tests
    moduleNameMapper: {
        '\\.(css|less|scss|sass)$': 'identity-obj-proxy', // Mock CSS modules
    },
    setupFilesAfterEnv: ['<rootDir>/jest.setup.mjs'], // Updated to match the renamed setup file
    collectCoverage: true, // Enable test coverage collection
    coverageDirectory: 'coverage', // Directory to output coverage reports
    coverageReporters: ['json', 'lcov', 'text', 'clover'], // Formats for coverage reports
    coverageThreshold: { // Enforce minimum coverage thresholds
        global: {
            branches: 80,
            functions: 80,
            lines: 80,
            statements: 80,
        },
    },
};
