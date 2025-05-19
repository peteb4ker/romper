import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import autoprefixer from 'autoprefixer'; // Import autoprefixer
import tailwindcss from 'tailwindcss'; // Import Tailwind CSS

export default defineConfig({
    plugins: [react()],
    root: 'src/renderer',
    build: {
        outDir: '../../dist/renderer',
        emptyOutDir: true
    },
    css: {
        postcss: {
            plugins: [
                tailwindcss(), // Add Tailwind CSS
                autoprefixer(),
                // Add other PostCSS plugins here
            ],
        },
    },
});