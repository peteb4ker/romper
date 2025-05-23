import { defineConfig } from 'eslint/config'
import js from '@eslint/js'
import tseslint from 'typescript-eslint'
import globals from 'globals'

export default defineConfig([
    {
        ignores: ['node_modules', 'dist', 'out', 'coverage', 'build'],
    },

    // JS files (browser environment)
    {
        files: ['**/*.js'],
        languageOptions: {
            ecmaVersion: 'latest',
            sourceType: 'module',
            globals: globals.browser,
        },
        plugins: {
            js,
        },
        rules: {
            ...js.configs.recommended.rules,
            'no-unused-vars': 'warn',
            'no-undef': 'warn',
        },
    },

    // TypeScript files
    {
        files: ['**/*.ts', '**/*.tsx'],
        languageOptions: {
            parser: tseslint.parser,
            globals: globals.browser,
        },
        plugins: {
            '@typescript-eslint': tseslint.plugin,
        },
        rules: {
            ...tseslint.configs.recommendedTypeChecked.rules,
        },
    },

    // Test files (Jest or Vitest)
    {
        files: ['**/*.test.js', '**/*.test.ts', '**/*.test.tsx'],
        languageOptions: {
            globals: {
                ...globals.browser,
                ...globals.jest, // or ...globals.vitest if using Vitest
                jest: true,
            },
        },
    },

    // Config files (Node environment)
    {
        files: ['*.config.js', '*.config.ts'],
        languageOptions: {
            globals: globals.node,
        },
    },
])
