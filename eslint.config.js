import js from '@eslint/js'
import { defineConfig } from 'eslint/config'
import simpleImportSort from 'eslint-plugin-simple-import-sort'
import globals from 'globals'
import tseslint from 'typescript-eslint'

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
            'simple-import-sort': simpleImportSort
        },
        rules: {
            ...js.configs.recommended.rules,
            'no-unused-vars': 'warn',
            'no-undef': 'warn',
            'simple-import-sort/imports': 'error',
            'simple-import-sort/exports': 'error',
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
            'simple-import-sort': simpleImportSort
        },
        rules: {
            ...tseslint.configs.recommendedTypeChecked.rules,
            'simple-import-sort/imports': 'error',
            'simple-import-sort/exports': 'error',
        },
    },

    {
        files: ['**/*.test.js', '**/*.test.ts', '**/*.test.tsx'],
        languageOptions: {
            globals: {
                ...globals.browser,
                ...globals.vitest, // or ...globals.vitest if using Vitest
                vitest: true,
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
