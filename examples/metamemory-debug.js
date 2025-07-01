/**
 * Debug Metamemory Tool Result
 */

import { config } from 'dotenv';
import { Agent, ensembleRequest, createToolFunction } from '@just-every/ensemble';

// Load environment variables from .env file
config();

async function debugToolResult() {
    console.log('=== Debug Tool Result ===\n');
    
    // Create a simple tool
    const analyzeMessages = createToolFunction(
        async (args) => {
            console.log('Tool function called with args:', args);
            return args;
        },
        'Analyze messages and assign thread tags',
        {
            messageAnalysis: {
                type: 'array',
                description: 'Analysis results for each message',
                items: {
                    type: 'object',
                    properties: {
                        messageId: { type: 'string' },
                        threadIds: { type: 'array', items: { type: 'string' } },
                        confidence: { type: 'number' }
                    },
                    required: ['messageId', 'threadIds', 'confidence']
                }
            },
            reasoning: { type: 'string', description: 'Reasoning for the analysis' }
        },
        undefined,
        'analyze_messages'
    );

    const agent = new Agent({
        name: 'TestAgent',
        modelClass: 'standard',
        instructions: 'You are analyzing messages. Use the analyze_messages tool to provide your analysis.',
        tools: [analyzeMessages],
        modelSettings: {
            tool_choice: 'required'
        }
    });

    const messages = [{
        type: 'message',
        role: 'user',
        content: `Analyze these messages and use the analyze_messages tool:
1. User: "What is recursion?"
2. Assistant: "Recursion is when a function calls itself..."

Provide messageAnalysis array with one entry per message.`
    }];

    console.log('Sending request...\n');

    for await (const event of ensembleRequest(messages, agent)) {
        if (event.type === 'tool_done' && 'result' in event) {
            const toolEvent = event;
            console.log('Tool done event:', {
                type: event.type,
                tool_call: toolEvent.tool_call,
                result: toolEvent.result
            });
            
            const toolName = toolEvent.tool_call?.function?.name;
            if (toolName === 'analyze_messages') {
                console.log('\nExtracted result:', toolEvent.result);
                console.log('Result type:', typeof toolEvent.result);
                console.log('Has messageAnalysis?', 'messageAnalysis' in toolEvent.result);
            }
        }
    }
}

// Run debug
debugToolResult().catch(error => {
    console.error('\nError:', error);
    process.exit(1);
});