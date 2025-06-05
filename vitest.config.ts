import { defineConfig } from 'vitest/config';
import dotenv from 'dotenv';

// Load environment variables from .env file
dotenv.config();

export default defineConfig({
    test: {
        globals: true,
        environment: 'node',
        include: ['test/**/*.test.ts'],
        setupFiles: ['dotenv/config', './test/setup.ts'],
    },
});