import { paraglideVitePlugin } from '@inlang/paraglide-js';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

const githubPagesBase = '/Brickhead/';

export default defineConfig(({ command }) => ({
    base: command === 'build' ? githubPagesBase : '/',
    plugins: [
        react(),
        tailwindcss(),
        paraglideVitePlugin({
            project: './i18n/project.inlang',
            outdir: './src/paraglide',
            emitTsDeclarations: true,
            strategy: ['localStorage', 'baseLocale'],
            localStorageKey: 'brickhead.locale',
        }),
    ],
    resolve: {
        tsconfigPaths: true,
    },
}));
