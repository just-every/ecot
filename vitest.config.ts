import { defineConfig } from 'vitest/config';

export default defineConfig({
    test: {
        globals: true,
        environment: 'node',
        include: ['test/**/*.test.ts'],
        env: {
            OPENAI_API_KEY: 'test-key-for-testing',
            ANTHROPIC_API_KEY: 'test-key-for-testing',
            GOOGLE_API_KEY: 'test-key-for-testing',
        },
    },
});