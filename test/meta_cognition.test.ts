import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { spawnMetaThought } from '../meta_cognition.js';
import { mechState } from '../mech_state.js';
import type { MechAgent, MechContext } from '../types.js';

// Mock ensemble imports
vi.mock('@just-every/ensemble', () => ({
    getModelFromClass: vi.fn().mockResolvedValue('gpt-4-turbo'),
    ResponseInput: Array
}));

describe('Meta-cognition', () => {
    let mockAgent: MechAgent;
    let mockContext: MechContext;
    let consoleLogSpy: any;
    let consoleErrorSpy: any;

    beforeEach(() => {
        // Reset state
        mechState.metaFrequency = '5';
        mechState.llmRequestCount = 0;
        mechState.disabledModels.clear();
        Object.keys(mechState.modelScores).forEach(key => {
            delete mechState.modelScores[key];
        });


        // Spy on console
        consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
        consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

        // Create mock agent
        mockAgent = {
            name: 'TestAgent',
            agent_id: 'test-agent-001',
            modelClass: 'reasoning',
            export: () => ({ name: 'TestAgent' }),
            getTools: async () => []
        };

        // Create mock context
        mockContext = {
            sendComms: vi.fn(),
            getCommunicationManager: () => ({
                send: vi.fn(),
                isClosed: () => false,
                close: vi.fn()
            }),
            addHistory: vi.fn(),
            getHistory: () => [],
            processPendingHistoryThreads: async () => {},
            describeHistory: (agent, messages) => messages,
            costTracker: { getTotalCost: () => 0 },
            runStreamedWithTools: vi.fn().mockResolvedValue({ response: 'test', tool_calls: [] }),
            dateFormat: () => '2024-01-01T00:00:00Z',
            readableTime: (ms) => `${ms}ms`,
            MAGI_CONTEXT: 'Test Context',
            createToolFunction: vi.fn((fn, desc) => ({
                function: fn,
                definition: { 
                    type: 'function', 
                    function: { 
                        name: fn.name || 'mockFunction', 
                        description: desc 
                    } 
                }
            }))
        };
    });

    afterEach(() => {
        consoleLogSpy.mockRestore();
        consoleErrorSpy.mockRestore();
    });

    describe('Basic functionality', () => {
        it('should spawn metacognition process successfully', async () => {
            const startTime = new Date();
            
            await spawnMetaThought(mockAgent, mockContext, startTime);
            
            expect(consoleLogSpy).toHaveBeenCalledWith('[MECH] Spawning metacognition process');
        });

        it('should create a metacognition agent', async () => {
            const startTime = new Date();
            
            await spawnMetaThought(mockAgent, mockContext, startTime);
            
            // Should log about spawning metacognition process
            expect(consoleLogSpy).toHaveBeenCalledWith('[MECH] Spawning metacognition process');
        });

        it('should include status information in context', async () => {
            const startTime = new Date();
            mockContext.listActiveProjects = async () => 'Project1, Project2';
            mockContext.runningToolTracker = { listActive: () => 'Tool1, Tool2' };
            
            await spawnMetaThought(mockAgent, mockContext, startTime);
            
            
            // Check that history was added with status information
            const historyCall = (mockContext.addHistory as any).mock.calls.find(
                (call: any[]) => call[0]?.content?.includes('=== TestAgent Status ===')
            );
            
            expect(historyCall).toBeDefined();
            if (historyCall) {
                const content = historyCall[0].content;
                expect(content).toContain('TestAgent Status');
                expect(content).toContain('Thought Delay:');
                expect(content).toContain('Projects:');
                expect(content).toContain('Active Tools:');
                expect(content).toContain('Metacognition Status');
            }
        });
    });

    describe('Error handling', () => {
        it('should validate agent parameter', async () => {
            const startTime = new Date();
            
            await expect(spawnMetaThought(null as any, mockContext, startTime))
                .rejects.toThrow('Invalid agent');
            
            await expect(spawnMetaThought(undefined as any, mockContext, startTime))
                .rejects.toThrow('Invalid agent');
        });

        it('should validate context parameter', async () => {
            const startTime = new Date();
            
            await expect(spawnMetaThought(mockAgent, null as any, startTime))
                .rejects.toThrow('Invalid context');
            
            await expect(spawnMetaThought(mockAgent, undefined as any, startTime))
                .rejects.toThrow('Invalid context');
        });

        it('should validate startTime parameter', async () => {
            await expect(spawnMetaThought(mockAgent, mockContext, null as any))
                .rejects.toThrow('Invalid startTime');
            
            await expect(spawnMetaThought(mockAgent, mockContext, 'not-a-date' as any))
                .rejects.toThrow('Invalid startTime');
        });

        it('should handle model selection failure gracefully', async () => {
            const { getModelFromClass } = await import('@just-every/ensemble');
            (getModelFromClass as any)
                .mockRejectedValueOnce(new Error('No metacognition model'))
                .mockResolvedValueOnce('gpt-4'); // Fallback
            
            const startTime = new Date();
            await spawnMetaThought(mockAgent, mockContext, startTime);
            
            expect(consoleErrorSpy).toHaveBeenCalledWith(
                '[MECH] Failed to get metacognition model:',
                expect.any(Error)
            );
        });

        it('should throw if no model is available', async () => {
            const { getModelFromClass } = await import('@just-every/ensemble');
            
            // Temporarily make the mock fail for both metacognition and reasoning calls
            (getModelFromClass as any).mockRejectedValue(new Error('No models available'));
            
            const startTime = new Date();
            await expect(spawnMetaThought(mockAgent, mockContext, startTime))
                .rejects.toThrow('No model available for metacognition');
                
            // Restore the mock for subsequent tests
            (getModelFromClass as any).mockResolvedValue('gpt-4-turbo');
        });

        it('should catch and log non-critical errors', async () => {
            // Store original function
            const originalDescribeHistory = mockContext.describeHistory;
            
            // Mock describeHistory to throw
            mockContext.describeHistory = () => {
                throw new Error('History error');
            };
            
            const startTime = new Date();
            await spawnMetaThought(mockAgent, mockContext, startTime);
            
            expect(consoleErrorSpy).toHaveBeenCalledWith(
                '[MECH] Error in metacognition process:',
                expect.any(Error)
            );
            
            // Restore original function
            mockContext.describeHistory = originalDescribeHistory;
        });
    });

    describe('Tool integration', () => {
        it('should include metacognition tools', async () => {
            const tools: any[] = [];
            mockContext.createToolFunction = vi.fn((fn, desc) => {
                const tool = {
                    function: fn,
                    definition: { type: 'function', function: { name: fn.name, description: desc } }
                };
                tools.push(tool);
                return tool;
            });
            
            const startTime = new Date();
            await spawnMetaThought(mockAgent, mockContext, startTime);
            
            // Should have created tools
            expect(tools.length).toBeGreaterThan(0);
            
            // Check for specific tools
            const toolNames = tools.map(t => t.definition.function.name);
            expect(toolNames).toContain('injectThoughtTool');
            expect(toolNames).toContain('setMetaFrequencyTool');
            expect(toolNames).toContain('setModelScoreTool');
            expect(toolNames).toContain('disableModelTool');
        });
    });

    describe('State display', () => {
        it('should show correct meta frequency', async () => {
            mechState.metaFrequency = '10';
            
            const startTime = new Date();
            await spawnMetaThought(mockAgent, mockContext, startTime);
            
            const historyCall = (mockContext.addHistory as any).mock.calls.find(
                (call: any[]) => call[0]?.content?.includes('Meta Frequency:')
            );
            
            expect(historyCall[0].content).toContain('Meta Frequency: 10');
        });

        it('should show disabled models', async () => {
            mechState.disabledModels.add('gpt-4');
            mechState.disabledModels.add('claude-3');
            
            const startTime = new Date();
            await spawnMetaThought(mockAgent, mockContext, startTime);
            
            const historyCall = (mockContext.addHistory as any).mock.calls.find(
                (call: any[]) => call[0]?.content?.includes('Disabled Models:')
            );
            
            expect(historyCall[0].content).toContain('gpt-4');
            expect(historyCall[0].content).toContain('claude-3');
        });

        it('should show model scores', async () => {
            mechState.modelScores['gpt-4'] = 85;
            mechState.modelScores['claude-3'] = 90;
            
            const startTime = new Date();
            await spawnMetaThought(mockAgent, mockContext, startTime);
            
            const historyCall = (mockContext.addHistory as any).mock.calls.find(
                (call: any[]) => call[0]?.content?.includes('Model Scores:')
            );
            
            // The listModelScores function should be called
            expect(historyCall[0].content).toContain('Model Scores:');
        });
    });

    describe('Timing calculations', () => {
        it('should calculate running time correctly', async () => {
            const startTime = new Date('2024-01-01T00:00:00Z');
            const currentTime = new Date('2024-01-01T00:05:00Z');
            
            // Mock Date to control current time
            const originalDate = global.Date;
            global.Date = vi.fn(() => currentTime) as any;
            global.Date.prototype = originalDate.prototype;
            
            await spawnMetaThought(mockAgent, mockContext, startTime);
            
            const historyCall = (mockContext.addHistory as any).mock.calls.find(
                (call: any[]) => call[0]?.content?.includes('Running Time:')
            );
            
            // Should show 5 minutes = 300000ms
            expect(historyCall[0].content).toContain('Running Time: 300000ms');
            
            // Restore Date
            global.Date = originalDate;
        });
    });
});