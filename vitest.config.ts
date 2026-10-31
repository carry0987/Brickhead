import os from 'node:os';
import path from 'node:path';
import { defineConfig } from 'vitest/config';

const projectRoot = import.meta.dirname;

export default defineConfig({
    resolve: {
        alias: {
            '@': path.resolve(projectRoot, 'src'),
        },
    },
    test: {
        environment: 'happy-dom',
        execArgv: ['--localstorage-file', path.resolve(os.tmpdir(), `vitest-${process.pid}.localstorage`)],
        typecheck: {
            // Type check options (optional)
            enabled: true,
        },
    },
});
