import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import autoprefixer from 'autoprefixer';
import tailwindcss from 'tailwindcss';
import { viteStaticCopy } from 'vite-plugin-static-copy';

export default defineConfig({
    plugins: [
        react(),
        viteStaticCopy({
            targets: [
                {
                    src: '../resources/*', // Adjusted path relative to 'src/renderer'
                    dest: '../resources'  // Place resources in dist/resources
                }
            ]
        })
    ],
    root: 'src/renderer',
    build: {
        outDir: '../../dist/renderer',
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
});