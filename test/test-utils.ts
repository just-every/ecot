/**
 * Test utilities for MECH tests
 * Simplifies mocking of ensemble's request
 */

import { vi } from 'vitest';
import { ToolCallAction } from '@just-every/ensemble';
import { EnhancedRequestMock } from '@just-every/ensemble/dist/utils/test_utils.js';

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
 * Creates a mock request implementation
 */
export function createMockEnhancedRequest(responses: MockResponse | MockResponse[]) {
    const responseArray = Array.isArray(responses) ? responses : [responses];
    let responseIndex = 0;
    
    return vi.fn((_model, _messages, options, context) => {
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
            
            // Process tool calls if provided
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
                    
                    if (options?.toolHandler?.onToolCall) {
                        const action = await options.toolHandler.onToolCall(fullToolCall, context);
                        
                        if (action === ToolCallAction.EXECUTE && options?.toolHandler?.onToolComplete) {
                            const result = toolCall.name === 'task_fatal_error' 
                                ? toolCall.arguments.error 
                                : toolCall.arguments.result || 'Tool executed';
                                
                            await options.toolHandler.onToolComplete(fullToolCall, result, context);
                        }
                    }
                }
            }
        })();
    });
}

/**
 * Creates a simple success response mock using ensemble's EnhancedRequestMock
 */
export function mockSuccessResponse(message = 'Task completed', result = 'Success') {
    return EnhancedRequestMock.success(message, result).getMock();
}

/**
 * Creates a simple error response mock using ensemble's EnhancedRequestMock
 */
export function mockErrorResponse(message = 'Task failed', error = 'Error occurred') {
    return EnhancedRequestMock.error(message, error).getMock();
}

/**
 * Creates a mock that throws an error
 */
export function mockThrowingResponse(error: Error | string) {
    return createMockEnhancedRequest({
        error: typeof error === 'string' ? new Error(error) : error
    });
}