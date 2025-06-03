/**
 * Minimal Real End-to-End Tests for MECH
 * 
 * These tests use actual LLM APIs to verify basic MECH functionality.
 * They are kept minimal to reduce costs and execution time.
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { config } from 'dotenv';
import { runMECH } from '../index.js';

// Load environment variables
config();

// Skip these tests if no API keys are available
const hasApiKeys = process.env.OPENAI_API_KEY || process.env.ANTHROPIC_API_KEY || process.env.DEEPSEEK_API_KEY;
const skipE2E = !hasApiKeys || process.env.SKIP_E2E_TESTS === 'true';

describe.skipIf(skipE2E)('Real E2E Tests', () => {
    beforeAll(() => {
        if (!hasApiKeys) {
            console.log('⚠️  Skipping E2E tests - no API keys found');
            console.log('   Set OPENAI_API_KEY, ANTHROPIC_API_KEY, or DEEPSEEK_API_KEY to run these tests');
        }
    });

    it('should complete a simple task with real LLM', async () => {
        const result = await runMECH({
            agent: { 
                name: 'TestAgent',
                modelClass: 'standard' // Use standard models
            },
            task: 'What is 2+2? Reply with just the number.',
            loop: false
        });

        // Basic success checks
        expect(result.status).toBe('complete');
        expect(result.mechOutcome?.result).toBeDefined();
        expect(result.mechOutcome?.result).toContain('4');
    }, 30000);

    it('should handle task failure appropriately', async () => {
        const result = await runMECH({
            agent: { 
                name: 'TestAgent',
                modelClass: 'standard'
            },
            task: 'Call task_fatal_error with the message "test error"',
            loop: false
        });

        expect(result.status).toBe('fatal_error');
        expect(result.mechOutcome?.error).toContain('test error');
    }, 30000);
});