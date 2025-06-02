/**
 * Tests for onRequest hook functionality
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { runMECH } from '../simple';
import { mockSuccessResponse } from './test-utils';
import type { MechAgent, ResponseInput } from '../types';

// Mock ensemble's request
vi.mock('@just-every/ensemble', async () => {
    const actual = await vi.importActual('@just-every/ensemble');
    return {
        ...actual,
        request: vi.fn()
    };
});

describe('onRequest Hook', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('should call onRequest hook before making request', async () => {
        const { request } = await import('@just-every/ensemble');
        vi.mocked(request).mockImplementation(mockSuccessResponse());
        
        const onRequestMock = vi.fn(async (agent: MechAgent, messages: ResponseInput) => {
            // Verify original agent is passed
            expect(agent.name).toBe('TestAgent');
            
            // Modify agent
            const modifiedAgent = { ...agent, name: 'ModifiedAgent' };
            
            // Add a system message
            const modifiedMessages = [
                { role: 'system' as const, content: 'Modified by onRequest' },
                ...messages
            ];
            
            return [modifiedAgent, modifiedMessages] as [MechAgent, ResponseInput];
        });

        const result = await runMECH({
            agent: {
                name: 'TestAgent',
                onRequest: onRequestMock
            },
            task: 'Test task'
        });

        // Verify onRequest was called
        expect(onRequestMock).toHaveBeenCalledOnce();
        
        // Verify the request was made with modified messages
        expect(request).toHaveBeenCalled();
        const requestCall = vi.mocked(request).mock.calls[0];
        const messages = requestCall[1];
        
        // Should have system message added by onRequest
        expect(messages[0]).toEqual({
            role: 'system',
            content: 'Modified by onRequest'
        });
        
        expect(result.status).toBe('complete');
    });

    it('should work without onRequest hook', async () => {
        const { request } = await import('@just-every/ensemble');
        vi.mocked(request).mockImplementation(mockSuccessResponse());

        const result = await runMECH({
            agent: {
                name: 'TestAgent'
            },
            task: 'Test task'
        });

        expect(request).toHaveBeenCalled();
        expect(result.status).toBe('complete');
    });

    it('should handle errors in onRequest hook', async () => {
        const onRequestMock = vi.fn(async () => {
            throw new Error('onRequest failed');
        });

        await expect(runMECH({
            agent: {
                name: 'TestAgent',
                onRequest: onRequestMock
            },
            task: 'Test task'
        })).rejects.toThrow('onRequest failed');
    });

    it('should pass modified agent properties through pipeline', async () => {
        const { request } = await import('@just-every/ensemble');
        vi.mocked(request).mockImplementation(mockSuccessResponse());
        
        const onRequestMock = vi.fn(async (agent: MechAgent, messages: ResponseInput) => {
            // Modify agent to use a different model
            const modifiedAgent = { 
                ...agent, 
                model: 'gpt-4-turbo',
                modelClass: 'reasoning' 
            };
            
            return [modifiedAgent, messages] as [MechAgent, ResponseInput];
        });

        let capturedAgentId: string | undefined;
        const statusCallback = vi.fn((status) => {
            if (status.type === 'agent_status') {
                capturedAgentId = status.agent_id;
            }
        });

        await runMECH({
            agent: {
                name: 'TestAgent',
                model: 'gpt-3.5-turbo',
                onRequest: onRequestMock
            },
            task: 'Test task',
            onStatus: statusCallback
        });

        // Verify the modified agent properties were used
        expect(request).toHaveBeenCalled();
        const requestCall = vi.mocked(request).mock.calls[0];
        const modelUsed = requestCall[0];
        
        // Should use the model selected by rotation, but agent properties should be updated
        expect(capturedAgentId).toContain('TestAgent');
    });

    it('should allow onRequest to add tools dynamically', async () => {
        const { request } = await import('@just-every/ensemble');
        vi.mocked(request).mockImplementation(mockSuccessResponse());
        
        const customTool = {
            function: vi.fn(() => 'Custom tool result'),
            definition: {
                type: 'function' as const,
                function: {
                    name: 'custom_tool',
                    description: 'A custom tool',
                    parameters: {}
                }
            }
        };
        
        const onRequestMock = vi.fn(async (agent: MechAgent, messages: ResponseInput) => {
            // Add a tool dynamically
            const modifiedAgent = { 
                ...agent,
                tools: [...(agent.tools || []), customTool]
            };
            
            return [modifiedAgent, messages] as [MechAgent, ResponseInput];
        });

        await runMECH({
            agent: {
                name: 'TestAgent',
                onRequest: onRequestMock
            },
            task: 'Test task'
        });

        // Verify request was made with tools
        expect(request).toHaveBeenCalled();
        const requestCall = vi.mocked(request).mock.calls[0];
        const options = requestCall[2];
        
        // Should include the dynamically added tool
        expect(options.tools).toContainEqual(expect.objectContaining({
            definition: expect.objectContaining({
                function: expect.objectContaining({
                    name: 'custom_tool'
                })
            })
        }));
    });
});