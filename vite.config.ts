import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import autoprefixer from 'autoprefixer';
import tailwindcss from '@tailwindcss/vite';
import { viteStaticCopy } from 'vite-plugin-static-copy';

export default defineConfig({
    base: './',
    plugins: [
        react(),
        tailwindcss(),
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
    test: {
        include: ['src/**/__tests__/*.{test,spec}.{js,ts,jsx,tsx}'],
        exclude: ['node_modules', 'dist', 'out'],
        environment: 'jsdom',
        setupFiles: ['./vitest.setup.ts'],
        coverage: {
            enabled: true,
            reporter: ['json', 'html'],
            reportsDirectory: './coverage',
            include: ['src/**/*.ts', 'src/**/*.tsx', 'shared/**/*.ts'],
            exclude: ['src/**/*.d.ts', 'src/renderer/styles/**'],
            reportOnFailure: true
        },
    },
});