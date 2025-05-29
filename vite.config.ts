import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import autoprefixer from 'autoprefixer';
import tailwindcss from 'tailwindcss';
import { viteStaticCopy } from 'vite-plugin-static-copy';

export default defineConfig({
    base: './',
    plugins: [
        react(),
        viteStaticCopy({
            targets: [
                {
                    src: 'resources/*',
                    dest: 'resources'
                }
            ]
        })
    ],
    root: '.',
    build: {
        // Only build the renderer (frontend) and shared code
        outDir: 'dist/renderer',
        emptyOutDir: true,
    },
    css: {
        postcss: {
            plugins: [
                tailwindcss(),
                autoprefixer(),
            ],
        },
    },
    test: {
        include: ['src/**/__tests__/*.{test,spec}.{js,ts,jsx,tsx}'],
        exclude: ['node_modules', 'dist', 'out'],
        environment: 'jsdom',
        setupFiles: ['./vitest.setup.ts'],
        setupFilesAfterEnv: ['./jest-dom.setup.ts'],
        coverage: {
            enabled: true,
            reporter: ['json', 'text', 'html'],
            reportsDirectory: './coverage',
            include: ['src/**/*.ts', 'src/**/*.tsx', 'shared/**/*.ts'],
            exclude: ['src/**/*.d.ts', 'src/renderer/styles/**'],
            reportOnFailure: true
        },
    },
});