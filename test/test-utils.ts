/**
 * Test utilities for Mind tests
 * Simplifies mocking of ensemble's request
 */

import { vi } from 'vitest';

export interface MockToolCall {
    name: string;
    arguments: Record<string, any>;
}

export interface MockResponse {
    message?: string;
    toolCalls?: MockToolCall[];
    error?: Error;
}

/**
 * Creates a mock request implementation for ensembleRequest
 */
export function createMockEnhancedRequest(responses: MockResponse | MockResponse[]) {
    const responseArray = Array.isArray(responses) ? responses : [responses];
    let responseIndex = 0;
    
    return vi.fn((_messages, agent) => {
        return (async function* () {
            const response = responseArray[responseIndex % responseArray.length];
            responseIndex++;
            
            if (response.error) {
                throw response.error;
            }
            
            // Yield message if provided
            if (response.message) {
                yield { type: 'message_delta', content: response.message };
            }
            
            // Process tool calls if provided - using new ensemble API pattern
            if (response.toolCalls) {
                for (const toolCall of response.toolCalls) {
                    const fullToolCall = {
                        id: `mock-${Date.now()}-${Math.random()}`,
                        type: 'function' as const,
                        function: {
                            name: toolCall.name,
                            arguments: JSON.stringify(toolCall.arguments)
                        }
                    };
                    
                    // Yield the tool call event
                    yield {
                        type: 'tool_call',
                        tool_calls: [fullToolCall]
                    };
                    
                    // Find and execute the tool
                    const tool = agent?.tools?.find((t: any) => 
                        t.definition?.function?.name === toolCall.name
                    );
                    
                    if (tool && agent?.onToolResult) {
                        // Execute the tool function
                        const result = await tool.function(toolCall.arguments);
                        
                        // Call onToolResult with the result
                        await agent.onToolResult({
                            toolCall: fullToolCall,
                            id: fullToolCall.id,
                            call_id: fullToolCall.id,
                            output: result,
                            error: undefined
                        });
                    }
                }
            }
        })();
    });
}

/**
 * Creates a simple success response mock
 */
export function mockSuccessResponse(message = 'Task completed', result = 'Success') {
    return createMockEnhancedRequest({
        message,
        toolCalls: [{
            name: 'task_complete',
            arguments: { result }
        }]
    });
}

/**
 * Creates a simple error response mock
 */
export function mockErrorResponse(message = 'Task failed', error = 'Error occurred') {
    return createMockEnhancedRequest({
        message,
        toolCalls: [{
            name: 'task_fatal_error',
            arguments: { error }
        }]
    });
}

/**
 * Creates a mock that throws an error
 */
export function mockThrowingResponse(error: Error | string) {
    return createMockEnhancedRequest({
        error: typeof error === 'string' ? new Error(error) : error
    });
}