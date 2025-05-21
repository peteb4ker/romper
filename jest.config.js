export default {
    // Only include test files in the root-level "tests" folder
    testMatch: ['<rootDir>/tests/**/*.(spec|test).[jt]s?(x)'],

    // Optional: explicitly ignore all other test folders if needed
    testPathIgnorePatterns: [
        '/node_modules/',
        '/dist/',
        '/out/',
    ],
    preset: 'ts-jest', // Use ts-jest for TypeScript support
    testEnvironment: 'jest-environment-jsdom', // Use jsdom for DOM-related tests
    moduleNameMapper: {
        '\\.(css|less|scss|sass)$': 'identity-obj-proxy', // Mock CSS modules
    },
    setupFilesAfterEnv: ['<rootDir>/jest.setup.mjs'], // Updated to match the renamed setup file
    collectCoverage: true, // Enable test coverage collection
    coverageDirectory: 'coverage', // Directory to output coverage reports
    coverageReporters: ['json', 'lcov', 'text', 'clover'], // Formats for coverage report
};
