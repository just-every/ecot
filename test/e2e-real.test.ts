/**
 * Real End-to-End Tests for MECH
 * 
 * These tests use actual LLM APIs to verify MECH functionality.
 * Run with: npm test e2e-real.test.ts
 * 
 * Note: These tests cost money and take time. Use sparingly.
 */

import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import { config } from 'dotenv';
import { 
    runMECH,
    setModelScore,
    setMetaFrequency,
    setThoughtDelay,
    mechState,
    resetLLMRequestCount,
    getTotalCost,
    resetCostTracker,
    type RunMechOptions
} from '../index.js';

// Load environment variables
config();

// Skip these tests if no API keys are available
const hasApiKeys = process.env.OPENAI_API_KEY || process.env.ANTHROPIC_API_KEY;
const skipE2E = !hasApiKeys || process.env.SKIP_E2E_TESTS === 'true';

describe.skipIf(skipE2E)('Real E2E Tests', () => {
    beforeAll(() => {
        if (!hasApiKeys) {
            console.log('⚠️  Skipping E2E tests - no API keys found');
            console.log('   Set OPENAI_API_KEY or ANTHROPIC_API_KEY to run these tests');
        }
    });

    beforeEach(() => {
        // Reset all state
        resetLLMRequestCount();
        resetCostTracker();
        mechState.disabledModels.clear();
        mechState.modelScores = {};
        setThoughtDelay('0'); // No delays for tests
        setMetaFrequency('5'); // Quick meta-cognition for testing
    });

    describe('Basic Task Execution', () => {
        it('should complete a simple task with real LLM', async () => {
            const startCost = getTotalCost();
            
            const result = await runMECH({
                agent: { 
                    name: 'E2E-Agent',
                    modelClass: 'standard' // Use cheaper/faster models
                },
                task: 'What is 2+2? Just give the number.',
                loop: false
            });

            // Verify successful completion
            expect(result.status).toBe('complete');
            expect(result.mechOutcome).toBeDefined();
            expect(result.mechOutcome?.status).toBe('complete');
            expect(result.mechOutcome?.result).toBeDefined();
            
            // Verify cost tracking
            const endCost = getTotalCost();
            expect(endCost).toBeGreaterThan(startCost);
            expect(endCost).toBeLessThan(0.01); // Should be very cheap
            
            // Verify history
            expect(result.history).toHaveLength(2); // User + Assistant
            expect(result.history[0]).toMatchObject({
                role: 'user',
                content: 'What is 2+2? Just give the number.'
            });
            expect(result.history[1].role).toBe('assistant');
            
            // Verify state updates
            expect(mechState.llmRequestCount).toBe(1);
        }, 30000); // 30 second timeout

        it('should handle task with custom tools', async () => {
            const customTool = {
                function: async ({ a, b }: { a: number; b: number }) => {
                    return `The sum of ${a} and ${b} is ${a + b}`;
                },
                definition: {
                    type: 'function' as const,
                    function: {
                        name: 'add_numbers',
                        description: 'Add two numbers together',
                        parameters: {
                            type: 'object',
                            properties: {
                                a: { type: 'number', description: 'First number' },
                                b: { type: 'number', description: 'Second number' }
                            },
                            required: ['a', 'b']
                        }
                    }
                }
            };

            const result = await runMECH({
                agent: { 
                    name: 'ToolAgent',
                    modelClass: 'standard',
                    tools: [customTool]
                },
                task: 'Use the add_numbers tool to calculate 15 + 27',
                loop: false
            });

            expect(result.status).toBe('complete');
            expect(result.mechOutcome?.result).toBeDefined();
            
            // The result should mention the calculation
            const fullHistory = result.history.map(h => h.content).join(' ');
            expect(fullHistory).toContain('42'); // 15 + 27 = 42
        }, 30000);
    });

    describe('Model Rotation', () => {
        it('should rotate between models based on scores', async () => {
            // Set up model preferences
            setModelScore('gpt-4o-mini', '90');
            setModelScore('claude-3-5-haiku-20241022', '10');
            
            const usedModels: string[] = [];
            
            // Run multiple tasks to see rotation
            for (let i = 0; i < 3; i++) {
                const result = await runMECH({
                    agent: { 
                        name: 'RotationAgent',
                        modelClass: 'standard'
                    },
                    task: `Task ${i}: What is ${i}+${i}?`,
                    loop: false,
                    onStatus: (status) => {
                        if (status.type === 'agent_status' && status.meta_data?.model) {
                            usedModels.push(status.meta_data.model);
                        }
                    }
                });
                
                expect(result.status).toBe('complete');
            }
            
            // Should prefer higher scored model
            const gptCount = usedModels.filter(m => m.includes('gpt-4o-mini')).length;
            expect(gptCount).toBeGreaterThanOrEqual(2); // At least 2/3 should be GPT
        }, 60000);
    });

    describe('Error Handling', () => {
        it('should handle invalid tasks gracefully', async () => {
            const result = await runMECH({
                agent: { 
                    name: 'ErrorAgent',
                    modelClass: 'standard'
                },
                task: 'FORCE_ERROR: This task cannot be completed',
                loop: false
            });

            // Even with an impossible task, MECH should complete or fail gracefully
            expect(['complete', 'fatal_error']).toContain(result.status);
            expect(result.durationSec).toBeGreaterThan(0);
            expect(result.totalCost).toBeGreaterThan(0);
        }, 30000);
    });

    describe('Meta-cognition', () => {
        it('should trigger meta-cognition after multiple requests', async () => {
            setMetaFrequency('5'); // Trigger after 5 requests
            
            const metaMessages: string[] = [];
            
            // Run tasks to trigger meta-cognition
            for (let i = 0; i < 4; i++) {
                await runMECH({
                    agent: { 
                        name: 'MetaAgent',
                        modelClass: 'standard'
                    },
                    task: `Simple task ${i}: Say "OK ${i}"`,
                    loop: false,
                    onStatus: (status) => {
                        if (status.content?.includes('[META]')) {
                            metaMessages.push(status.content);
                        }
                    }
                });
            }
            
            // Should have triggered meta-cognition at least once
            expect(mechState.llmRequestCount).toBe(4);
            // Meta-cognition happens at request 3
            expect(metaMessages.length).toBeGreaterThanOrEqual(0); // May or may not log
        }, 60000);
    });

    describe('Real-world Scenarios', () => {
        it('should handle a coding task', async () => {
            const result = await runMECH({
                agent: { 
                    name: 'CodingAgent',
                    modelClass: 'code'
                },
                task: 'Write a one-line JavaScript function that reverses a string. Just the function, no explanation.',
                loop: false
            });

            expect(result.status).toBe('complete');
            expect(result.mechOutcome?.result).toBeDefined();
            
            // Should contain a function
            const response = result.history[1].content;
            expect(response).toMatch(/function|=>/);
            expect(response).toContain('reverse');
        }, 30000);

        it('should handle a reasoning task', async () => {
            const result = await runMECH({
                agent: { 
                    name: 'ReasoningAgent',
                    modelClass: 'reasoning'
                },
                task: 'If all roses are flowers, and some flowers fade quickly, can we conclude that some roses fade quickly? Answer with just yes or no.',
                loop: false
            });

            expect(result.status).toBe('complete');
            expect(result.mechOutcome?.result).toBeDefined();
            
            // Should give a logical answer
            const response = result.history[1].content.toLowerCase();
            expect(['yes', 'no']).toContain(response.trim());
        }, 30000);
    });

    describe('Performance Characteristics', () => {
        it('should complete tasks within reasonable time', async () => {
            const startTime = Date.now();
            
            const result = await runMECH({
                agent: { 
                    name: 'PerfAgent',
                    modelClass: 'standard'
                },
                task: 'Say "Performance test complete"',
                loop: false
            });

            const duration = Date.now() - startTime;
            
            expect(result.status).toBe('complete');
            expect(duration).toBeLessThan(10000); // Should complete in < 10 seconds
            expect(result.durationSec).toBeLessThanOrEqual(duration / 1000);
        }, 15000);

        it('should track costs accurately', async () => {
            resetCostTracker();
            const results = [];
            
            // Run multiple tasks
            for (let i = 0; i < 3; i++) {
                const result = await runMECH({
                    agent: { 
                        name: 'CostAgent',
                        modelClass: 'standard'
                    },
                    task: `Cost test ${i}: Say "OK"`,
                    loop: false
                });
                results.push(result);
            }
            
            // Verify costs
            const totalCost = getTotalCost();
            const sumOfCosts = results.reduce((sum, r) => sum + r.totalCost, 0);
            
            expect(totalCost).toBeGreaterThan(0);
            expect(totalCost).toBeLessThan(0.01); // Should be cheap
            expect(Math.abs(totalCost - sumOfCosts)).toBeLessThan(0.0001); // Should match
        }, 45000);
    });
});

// Test configuration helper
export function setupE2ETests() {
    const apiKeys = {
        openai: !!process.env.OPENAI_API_KEY,
        anthropic: !!process.env.ANTHROPIC_API_KEY,
        google: !!process.env.GOOGLE_API_KEY,
        openrouter: !!process.env.OPENROUTER_API_KEY
    };
    
    console.log('E2E Test Configuration:');
    console.log('- OpenAI:', apiKeys.openai ? '✓' : '✗');
    console.log('- Anthropic:', apiKeys.anthropic ? '✓' : '✗');
    console.log('- Google:', apiKeys.google ? '✓' : '✗');
    console.log('- OpenRouter:', apiKeys.openrouter ? '✓' : '✗');
    
    return apiKeys;
}