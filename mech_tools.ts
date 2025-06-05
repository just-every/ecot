/**
 * MECH Tools - Enhanced Version
 *
 * Meta-cognition Ensemble Chain-of-thought Hierarchy (MECH) implementation.
 * This version uses ensemble's enhancedRequest for streamlined tool handling.
 */

import type { MechAgent, MechContext, MechOutcome, MechResult } from './types.js';
import { mechState } from './mech_state.js';
import { runThoughtDelay, getThoughtDelay } from './thought_utils.js';
import { spawnMetaThought } from './meta_cognition.js';
import { rotateModel } from './model_rotation.js';
import { 
    ensembleRequest,
    ToolCallAction,
    createRequestContextWithState,
    createToolFunction,
    type ToolFunction,
    type AgentDefinition,
    type ModelClassID
} from '@just-every/ensemble';
import { MESSAGE_TYPES, AGENT_STATUS } from './utils/constants.js';

/**
 * Get MECH control tools
 */
export function getMECHTools(): ToolFunction[] {
    return [
        createToolFunction(
            (args: { result: string }) => {
                console.log('[MECH] Task completed:', args.result);
                return `Task completed: ${args.result}`;
            },
            'Report that the task has completed successfully',
            {
                result: {
                    type: 'string',
                    description: 'A few paragraphs describing the result. Be thorough and comprehensive.'
                }
            },
            undefined, // returns parameter (not used)
            'task_complete' // explicit function name
        ),
        
        createToolFunction(
            (args: { error: string }) => {
                console.error('[MECH] Task failed:', args.error);
                return `Task failed: ${args.error}`;
            },
            'Report that you were not able to complete the task',
            {
                error: {
                    type: 'string',
                    description: 'Describe the error that occurred in a few sentences'
                }
            },
            undefined, // returns parameter (not used)
            'task_fatal_error' // explicit function name
        )
    ];
}

/**
 * Enhanced MECH execution using ensemble's enhancedRequest
 */
export async function runMECH(
    content: string,
    agent: MechAgent,
    context: MechContext,
    loop = true,
    metadata?: Record<string, any>
): Promise<MechResult> {
    const startTime = Date.now();
    
    // Add system prompt first to guide tool usage
    const toolGuidance = 'You must complete tasks by using the provided tools. When you have finished a task, you MUST call the task_complete tool with a comprehensive result. If you cannot complete the task, you MUST call the task_fatal_error tool with an explanation. Do not just provide a final answer without using these tools.';
    
    // Combine agent instructions with tool guidance if provided
    const systemContent = agent.instructions 
        ? `${agent.instructions}\n\n${toolGuidance}`
        : toolGuidance;
    
    context.addHistory({
        type: 'message',
        role: 'system',
        content: systemContent
    });
    
    // Add initial prompt to history
    context.addHistory({
        type: 'message',
        role: 'user',
        content,
    });

    // Add MECH tools to the agent
    const mechTools = getMECHTools();

    const comm = context.getCommunicationManager();
    
    // Get current messages
    let messages = context.getHistory();
    let currentAgent = agent;
    
    // Allow agent onRequest hook
    if (agent.onRequest) {
        [currentAgent, messages] = await agent.onRequest(agent, messages);
    }
    
    // Combine MECH tools with agent tools
    const allTools = [...mechTools, ...(currentAgent.tools || [])];
    
    // Create request context with state management
    const requestContext = createRequestContextWithState({
        metadata: {
            ...metadata,
            mechOutcome: {} as MechOutcome,
            mechStartTime: startTime
        },
        messages,
        onHalt: () => {
            comm.send({ type: 'MECH_HALTED', timestamp: Date.now() });
        }
    });
    
    // Initialize counter with current global count
    if (mechState.llmRequestCount > 0) {
        for (let i = 0; i < mechState.llmRequestCount; i++) {
            requestContext.incrementCounter('llmRequestCount');
        }
    }
    
    // Load existing model scores from mechState if available
    Object.entries(mechState.modelScores).forEach(([model, score]) => {
        if (typeof score === 'number') {
            requestContext.updateScore(model, score);
        }
    });
    
    // Load disabled models
    mechState.disabledModels.forEach(model => {
        requestContext.disableModel(model);
    });


    try {
        // Send start status
        comm.send({
            type: MESSAGE_TYPES.AGENT_STATUS,
            agent_id: currentAgent.agent_id,
            status: AGENT_STATUS.MECH_START,
            meta_data: {
                model: currentAgent.model,
            },
        });

        // Select model if needed
        let selectedModel = await rotateModel(currentAgent);
        
        // Check if model is disabled in state
        if (selectedModel && requestContext.isModelDisabled(selectedModel)) {
            console.log(`[MECH] Model ${selectedModel} is disabled, selecting alternative`);
            const disabledModels = requestContext.getDisabledModels();
            // Filter out disabled models and retry
            selectedModel = await rotateModel({
                ...currentAgent,
                excludeModels: disabledModels
            } as MechAgent);
        }
        
        if (!selectedModel) {
            throw new Error('No model available for execution');
        }
        
        // Track model usage
        requestContext.incrementCounter(`modelUsage:${selectedModel}`);
        
        // Increment LLM request count for initial request
        const requestCount = requestContext.incrementCounter('llmRequestCount');
        mechState.llmRequestCount = requestCount;
        
        // Log the system message to verify instructions are included
        const systemMessage = requestContext.messages.find(m => m.role === 'system');
        if (systemMessage) {
            console.log('[MECH] System message:', systemMessage.content);
        }
        
        // Create agent definition for ensemble
        const ensembleAgent: AgentDefinition = {
            agent_id: currentAgent.agent_id,
            name: currentAgent.name,
            model: selectedModel,
            modelClass: currentAgent.modelClass as ModelClassID | undefined,
            tools: allTools,
            maxToolCalls: 10, // Default max tool calls
            instructions: currentAgent.instructions,
            modelSettings: {
                tool_choice: 'required'
            },
            // Handle tool calls
            onToolCall: async (toolCall) => {
                const toolName = toolCall.function?.name;
                if (toolName === 'task_complete' || toolName === 'task_fatal_error') {
                    return ToolCallAction.EXECUTE;
                }
                return ToolCallAction.EXECUTE;
            },
            onToolResult: async (toolCallResult) => {
                const toolName = toolCallResult.toolCall.function.name;
                if (toolName === 'task_complete') {
                    requestContext.setMetadata('mechOutcome', {
                        status: 'complete',
                        result: toolCallResult.output
                    });
                    requestContext.halt();
                } else if (toolName === 'task_fatal_error') {
                    requestContext.setMetadata('mechOutcome', {
                        status: 'fatal_error',
                        error: toolCallResult.output
                    });
                    requestContext.halt();
                }
            }
        };
        
        // Run the request with loop handling
        let iteration = 0;
        let shouldContinue = true;
        
        while (shouldContinue && iteration < 100) {
            iteration++;
            
            // Track LLM requests
            const requestCount = requestContext.incrementCounter('llmRequestCount');
            mechState.llmRequestCount = requestCount;
            
            // Check meta-cognition trigger
            const metaFrequency = parseInt(mechState.metaFrequency);
            if (requestCount % metaFrequency === 0) {
                console.log(`[MECH] Triggering meta-cognition after ${requestCount} LLM requests`);
                try {
                    await spawnMetaThought(agent, context, new Date(startTime));
                    
                    // Update model scores
                    const scores = requestContext.getAllScores();
                    Object.entries(scores).forEach(([model, score]) => {
                        mechState.modelScores[model] = score;
                    });
                } catch (error) {
                    console.error('[MECH] Error in meta-cognition:', error);
                }
            }
            
            // Process pending history threads
            await context.processPendingHistoryThreads();
            
            // Apply thought delay
            const delay = getThoughtDelay();
            const delayNum = parseInt(delay);
            if (delayNum > 0) {
                await runThoughtDelay(context);
            }
            
            // Run the request
            for await (const event of ensembleRequest(
                requestContext.messages,
                ensembleAgent
            )) {
                // Send stream events if handler is available
                if (context.sendStreamEvent) {
                    context.sendStreamEvent(event);
                }
                
                // Log message content
                if (event.type === 'message_delta' && 'content' in event) {
                    console.log('[MECH] ', { response: event.content });
                }
            }
            
            // Check if we should continue or if task is complete
            if (!loop || requestContext.isHalted || comm.isClosed()) {
                shouldContinue = false;
            }
            
            // Check if we have an outcome
            const currentOutcome = requestContext.getMetadata<MechOutcome>('mechOutcome');
            if (currentOutcome && (currentOutcome.status === 'complete' || currentOutcome.status === 'fatal_error')) {
                shouldContinue = false;
            }
        }

        // Get outcome from context
        const outcome = requestContext.getMetadata<MechOutcome>('mechOutcome') || {
            status: 'incomplete',
            error: 'Task did not complete'
        };

        // Send completion status
        comm.send({
            type: MESSAGE_TYPES.AGENT_STATUS,
            agent_id: currentAgent.agent_id,
            status: AGENT_STATUS.MECH_DONE,
            meta_data: {
                model: selectedModel,
                modelScores: requestContext.getAllScores(),
                disabledModels: requestContext.getDisabledModels()
            },
        });

        // Calculate final metrics
        const endTime = Date.now();
        const durationSec = (endTime - startTime) / 1000;
        const totalCost = context.costTracker.getTotalCost();

        return {
            status: outcome?.status === 'complete' || outcome?.status === 'fatal_error' 
                ? outcome.status 
                : 'fatal_error',
            durationSec,
            totalCost,
            history: context.getHistory(),
            mechOutcome: outcome?.status === 'complete' || outcome?.status === 'fatal_error'
                ? outcome
                : { status: 'fatal_error', error: 'Task did not complete' }
        };

    } catch (error) {
        console.error('[MECH] Error running agent:', error);
        
        const errorMessage = error instanceof Error ? error.message : String(error);
        
        // Send error status
        comm.send({
            type: MESSAGE_TYPES.ERROR,
            error: errorMessage,
        });

        const endTime = Date.now();
        const durationSec = (endTime - startTime) / 1000;
        const totalCost = context.costTracker.getTotalCost();

        return {
            status: 'fatal_error',
            durationSec,
            totalCost,
            history: context.getHistory(),
            mechOutcome: {
                status: 'fatal_error',
                error: `Agent execution failed: ${errorMessage}`
            }
        };
    }
}

// Task completion and error handling are now integrated into getMECHTools