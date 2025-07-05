/**
 * Task Engine - Simplified Version
 *
 * Task implementation for LLM orchestration.
 * Provides meta-cognition and thought delays on top of ensemble.
 * Model rotation is handled by ensemble automatically.
 */

import { taskState } from '../state/state.js';
import { getThoughtDelay, runThoughtDelayWithController } from './thought_utils.js';
import { spawnMetaThought } from './meta_cognition.js';
import type { TaskLocalState } from '../types/task-state.js';
import type { TaskCompleteEvent, TaskFatalErrorEvent, TaskEvent } from '../types/events.js';
import { 
    ensembleRequest,
    createToolFunction,
    cloneAgent,
    waitWhilePaused,
    type ToolFunction,
    type Agent,
    type ResponseInput,
    type ProviderStreamEvent
} from '@just-every/ensemble';
import { Metamemory, createMetamemoryState, type MetamemoryState } from '../metamemory/index.js';
import { v4 as uuidv4 } from 'uuid';

// WeakMap to store message arrays for active tasks
const activeTaskMessages = new WeakMap<AsyncGenerator<ProviderStreamEvent>, ResponseInput>();

// Map to track cleanup functions for generators
const generatorCleanup = new WeakMap<AsyncGenerator<ProviderStreamEvent>, () => void>();

/**
 * Get Task control tools
 */
function getTaskTools(): ToolFunction[] {
    return [
        createToolFunction(
            (result: string ) => {
                //console.log('[Task] Task completed:', result);
                // Return the result so it can be captured in the tool_done event
                return result;
            },
            'Report that the task has completed successfully',
            {
                result: {
                    type: 'string',
                    description: 'A few paragraphs describing the result. Be thorough and comprehensive.'
                }
            },
            undefined,
            'task_complete'
        ),
        
        createToolFunction(
            (error: string ) => {
                console.error('[Task] Task failed:', error);
                // Return the error so it can be captured in the tool_done event
                return error;
            },
            'Report that you were not able to complete the task',
            {
                error: {
                    type: 'string',
                    description: 'Describe the error that occurred in a few sentences'
                }
            },
            undefined,
            'task_fatal_error'
        )
    ];
}

/**
 * Optional initial state for a task (can be used to resume from a previous task)
 */
export interface InitialTaskState {
    metaFrequency?: string;
    thoughtDelay?: string;
    disabledModels?: string[];
    modelScores?: Record<string, number>;
    messages?: ResponseInput;
    metamemoryEnabled?: boolean;
    metamemoryState?: MetamemoryState;
}

/**
 * Resume a task from a previous state
 * 
 * @param agent - The agent to use
 * @param finalState - The final state from a previous task
 * @param newContent - Optional new content to add to the conversation
 * @returns AsyncGenerator that yields events
 * 
 * @example
 * ```typescript
 * // First task
 * let finalState;
 * for await (const event of runTask(agent, 'Start analysis')) {
 *     if (event.type === 'task_complete') {
 *         finalState = event.finalState;
 *     }
 * }
 * 
 * // Resume with additional instructions
 * for await (const event of resumeTask(agent, finalState, 'Continue with security analysis')) {
 *     // ...
 * }
 * ```
 */
export function resumeTask(
    agent: Agent,
    finalState: TaskEvent['finalState'],
    newContent?: string
): AsyncGenerator<ProviderStreamEvent | TaskCompleteEvent | TaskFatalErrorEvent> {
    // If new content provided, add it to messages
    const messages = finalState.messages;
    if (newContent) {
        messages.push({
            type: 'message',
            role: 'user',
            content: newContent,
            id: uuidv4()
        });
    }
    
    // Resume with the full state
    return runTask(agent, newContent || 'Continue with the task', {
        metaFrequency: finalState.metaFrequency,
        thoughtDelay: finalState.thoughtDelay,
        disabledModels: finalState.disabledModels,
        modelScores: finalState.modelScores,
        messages: messages
    });
}

/**
 * Run Mind with automatic everything
 * 
 * @param agent - The agent from ensemble
 * @param content - The task/prompt to execute
 * @param initialState - Optional initial state for the task
 * @returns AsyncGenerator that yields all ProviderStreamEvents and TaskEvents
 * 
 * @example
 * ```typescript
 * import { Agent } from '@just-every/ensemble';
 * import { runTask } from '@just-every/task';
 * 
 * const agent = new Agent({ 
 *     name: 'MyAgent',
 *     modelClass: 'reasoning' 
 * });
 * 
 * for await (const event of runTask(agent, 'Analyze this code')) {
 *     console.log(event);
 * }
 * 
 * // With initial state
 * const state = { metaFrequency: '10', thoughtDelay: '2' };
 * for await (const event of runTask(agent, 'Complex task', state)) {
 *     console.log(event);
 * }
 * 
 * // Handle task completion with state
 * for await (const event of runTask(agent, 'Task')) {
 *     if (event.type === 'task_complete') {
 *         console.log('Result:', event.result);
 *         console.log('Final state:', event.finalState);
 *     }
 * }
 * ```
 */
export function runTask(
    agent: Agent,
    content: string,
    initialState?: InitialTaskState
): AsyncGenerator<ProviderStreamEvent | TaskCompleteEvent | TaskFatalErrorEvent> {
    // Basic validation
    if (!agent || typeof agent !== 'object') {
        throw new Error('Agent must be a valid Agent instance');
    }
    if (!content || typeof content !== 'string' || content.trim().length === 0) {
        throw new Error('Content must be a non-empty string');
    }
    
    // Build initial messages with tool guidance
    const toolGuidance = 'You must complete tasks by using the provided tools. When you have finished a task, you MUST call the task_complete tool with a comprehensive result. If you cannot complete the task, you MUST call the task_fatal_error tool with an explanation. Do not just provide a final answer without using these tools.';
    
    // Check if agent instructions already contain task_complete guidance
    if(!agent.instructions?.includes('task_complete')) {
        agent.instructions = agent.instructions ? `${agent.instructions}\n\n${toolGuidance}` : toolGuidance;
    }
    
    // Use provided messages or create new ones
    const messages: ResponseInput = initialState?.messages ? [...initialState.messages] : [
        {
            type: 'message',
            role: 'user',
            content,
            id: `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
        }
    ];

    // Create wrapper to handle cleanup
    async function* taskGenerator() {
        const startTime = Date.now();

        // Add Task tools to the agent
        const taskTools = getTaskTools();
        
        // Clone agent to get AgentDefinition and add Task tools
        const agentDef = cloneAgent(agent);
        agentDef.tools = [...taskTools, ...(agent.tools || [])];

        // Track completion state
        let isComplete = false;
        
        // Initialize metamemory if enabled
        let metamemory: Metamemory | undefined;
        if (initialState?.metamemoryEnabled || taskState.metamemoryEnabled) {
            metamemory = new Metamemory({
                agent: agent,
                config: taskState.metamemoryOptions as any
            });
        }
        
        // Task-local state (isolated from other tasks)
        const taskLocalState: TaskLocalState = {
            // Request counter for metacognition
            requestCount: 0,
            // Use initial state if provided, otherwise copy global state as starting point
            metaFrequency: initialState?.metaFrequency || taskState.metaFrequency,
            thoughtDelay: initialState?.thoughtDelay || getThoughtDelay(),
            disabledModels: new Set(initialState?.disabledModels || taskState.disabledModels),
            modelScores: initialState?.modelScores || { ...taskState.modelScores },
            // Task-local abort controller for thought delays
            delayAbortController: new AbortController(),
            // Metamemory state
            metamemoryEnabled: initialState?.metamemoryEnabled ?? taskState.metamemoryEnabled,
            metamemoryState: initialState?.metamemoryState || (metamemory ? createMetamemoryState() : undefined),
            metamemoryProcessing: false
        };
        
        try {
            //console.log(`[Task] Starting execution for agent: ${agent.name}`);
            
            // Run the request loop
            let iteration = 0;
            
            while (!isComplete && iteration < 100) {
                iteration++;
                
                // Wait if ensemble is paused (before any processing)
                await waitWhilePaused();
                
                // Apply thought delay (Mind-specific feature)
                if (iteration > 1) {
                    const delay = parseInt(taskLocalState.thoughtDelay);
                    if (delay > 0) {
                        await runThoughtDelayWithController(taskLocalState.delayAbortController, delay);
                    }
                }
                
                // Increment task-local request counter for meta-cognition
                taskLocalState.requestCount++;
                
                // Check meta-cognition trigger (Mind-specific feature)
                const metaFrequency = parseInt(taskLocalState.metaFrequency);
                if (taskLocalState.requestCount % metaFrequency === 0) {
                    //console.log(`[Task] Triggering meta-cognition after ${taskLocalState.requestCount} requests`);
                    try {
                        await spawnMetaThought(agentDef, messages, new Date(startTime), taskLocalState.requestCount, taskLocalState);
                    } catch (error) {
                        console.error('[Task] Error in meta-cognition:', error);
                    }
                }
                
                // Run ensemble request and yield all events
                for await (const event of ensembleRequest(messages, agentDef)) {
                    // Yield the event to the caller
                    yield event;
                    
                    // Handle tool calls
                    if (event.type === 'tool_done' && 'result' in event) {
                        const toolEvent = event as any;
                        const toolName = toolEvent.tool_call?.function?.name;
                        
                        if (toolName === 'task_complete') {
                            isComplete = true;
                            
                            // Wait for metamemory processing to complete if enabled
                            if (taskLocalState.metamemoryEnabled && taskLocalState.metamemoryProcessing) {
                                console.log('[Task] Waiting for metamemory to complete processing...');
                                // Default to 60s (increased from 30s)
                                const maxWaitTime = 60000;
                                const startWait = Date.now();
                                let lastLog = startWait;
                                
                                while (taskLocalState.metamemoryProcessing && (Date.now() - startWait) < maxWaitTime) {
                                    await new Promise(resolve => setTimeout(resolve, 100));
                                    
                                    // Log progress every 5 seconds
                                    if (Date.now() - lastLog > 5000) {
                                        const elapsed = Math.round((Date.now() - startWait) / 1000);
                                        console.log(`[Task] Still waiting for metamemory... (${elapsed}s elapsed)`);
                                        lastLog = Date.now();
                                    }
                                }
                                
                                if (taskLocalState.metamemoryProcessing) {
                                    console.log(`[Task] Warning: Metamemory processing timed out after ${maxWaitTime/1000}s`);
                                    console.log('[Task] Proceeding anyway - metamemory may complete in background');
                                } else {
                                    const totalTime = Math.round((Date.now() - startWait) / 1000);
                                    console.log(`[Task] Metamemory processing completed in ${totalTime}s`);
                                }
                            }
                            
                            // Emit task_complete event with final state
                            const completeEvent: TaskCompleteEvent = {
                                type: 'task_complete',
                                result: toolEvent.result?.output || '',
                                finalState: {
                                    metaFrequency: taskLocalState.metaFrequency,
                                    thoughtDelay: taskLocalState.thoughtDelay,
                                    disabledModels: Array.from(taskLocalState.disabledModels),
                                    modelScores: { ...taskLocalState.modelScores },
                                    messages: messages,
                                    metamemoryEnabled: taskLocalState.metamemoryEnabled,
                                    metamemoryState: taskLocalState.metamemoryState
                                }
                            };
                            yield completeEvent;
                        } else if (toolName === 'task_fatal_error') {
                            isComplete = true;
                            // Emit task_fatal_error event with final state
                            const errorEvent: TaskFatalErrorEvent = {
                                type: 'task_fatal_error',
                                result: toolEvent.result?.output || '',
                                finalState: {
                                    metaFrequency: taskLocalState.metaFrequency,
                                    thoughtDelay: taskLocalState.thoughtDelay,
                                    disabledModels: Array.from(taskLocalState.disabledModels),
                                    modelScores: { ...taskLocalState.modelScores },
                                    messages: messages,
                                    metamemoryEnabled: taskLocalState.metamemoryEnabled,
                                    metamemoryState: taskLocalState.metamemoryState
                                }
                            };
                            yield errorEvent;
                        }
                    }
                    
                    // Break out of the event loop if task is complete
                    if (isComplete) {
                        break;
                    }
                    
                    // Add response to history
                    if (event.type === 'response_output') {
                        const responseEvent = event as any;
                        if (responseEvent.message) {
                            if(!responseEvent.message.id) {
                                responseEvent.message.id = uuidv4();
                            }
                            messages.push(responseEvent.message);
                            
                            // Process with metamemory if enabled
                            if (metamemory && taskLocalState.metamemoryState && taskLocalState.metamemoryEnabled) {
                                // Check if we should process (simple check based on message count)
                                const shouldProcess = messages.length % 10 === 0; // Process every 10 messages
                                
                                if (shouldProcess && !taskLocalState.metamemoryProcessing) {
                                    // Process metamemory in the background - don't block!
                                    const messagesCopy = [...messages];
                                    
                                    // Mark as processing to prevent concurrent runs
                                    taskLocalState.metamemoryProcessing = true;
                                    
                                    // Fire and forget - process in background
                                    const processingStart = Date.now();
                                    metamemory.processMessages(messagesCopy).then(() => {
                                        const processingTime = Math.round((Date.now() - processingStart) / 1000);
                                        taskLocalState.metamemoryState = metamemory.getState();
                                        taskLocalState.metamemoryProcessing = false;
                                        console.log(`[Task] Metamemory background processing completed in ${processingTime}s`);
                                        
                                        // Emit state update for live streaming
                                        const state = taskLocalState.metamemoryState;
                                        if (state) {
                                            console.log('[Metamemory] LIVE_STATE_UPDATE:', JSON.stringify({
                                                threads: state.threads ? state.threads.size : 0,
                                                lastProcessedIndex: state.lastProcessedIndex
                                            }));
                                        }
                                    }).catch(error => {
                                        console.error('[Task] Error processing metamemory in background:', error);
                                        taskLocalState.metamemoryProcessing = false;
                                    });
                                } else if (shouldProcess && taskLocalState.metamemoryProcessing) {
                                    //console.log('[Task] Metamemory already processing, skipping trigger');
                                }
                            }
                        }
                    }
                }
            }

        } catch (error) {
            console.error('[Task] Error running agent:', error);
            
            // Yield an error event
            const errorMessage = error instanceof Error ? error.message : String(error);
            yield {
                type: 'error' as const,
                error: new Error(`Agent execution failed: ${errorMessage}`)
            } as ProviderStreamEvent;
        }
    }
    
    // Create the generator
    const generator = taskGenerator();

    // Store the messages array in the WeakMap
    activeTaskMessages.set(generator, messages);
    
    // Set up cleanup function
    const cleanup = () => {
        activeTaskMessages.delete(generator);
        generatorCleanup.delete(generator);
    };
    generatorCleanup.set(generator, cleanup);
    
    // Create a wrapper that ensures cleanup
    const wrappedGenerator = (async function* (): AsyncGenerator<ProviderStreamEvent> {
        try {
            for await (const event of generator) {
                yield event;
            }
        } finally {
            cleanup();
        }
    })();
    
    // Transfer the mapping to the wrapped generator
    activeTaskMessages.set(wrappedGenerator, messages);
    activeTaskMessages.delete(generator);
    generatorCleanup.set(wrappedGenerator, cleanup);
    generatorCleanup.delete(generator);
    
    return wrappedGenerator;
}

/**
 * Internal function to add a message to a messages array
 * Used by both addMessageToTask and metacognition's inject_thought
 */
export function internalAddMessage(
    messages: ResponseInput,
    message: ResponseInput[0],
    _source: 'external' | 'metacognition' = 'external'
): void {
    // Validate the message
    if (!message || typeof message !== 'object') {
        throw new Error('Message must be a valid message object');
    }
    if (!message.type || message.type !== 'message') {
        throw new Error('Message must have type "message"');
    }
    if (!message.role || !['system', 'user', 'assistant', 'developer'].includes(message.role)) {
        throw new Error('Message must have a valid role: system, user, assistant, or developer');
    }
    if (!message.content || typeof message.content !== 'string') {
        throw new Error('Message must have string content');
    }
    
    // Add ID if not present
    if (!message.id) {
        message.id = uuidv4();
    }
    
    // Add the message
    messages.push(message);
    //console.log(`[Task] ${source === 'metacognition' ? 'Metacognition' : 'External'} message added with role: ${message.role}`);
}

/**
 * Add a message to an active task's message stream
 * 
 * @param taskGenerator - The generator returned by runTask
 * @param message - The message to inject
 * 
 * @example
 * ```typescript
 * const task = runTask(agent, 'Analyze this code');
 * 
 * // Inject a message while task is running
 * addMessageToTask(task, {
 *     type: 'message',
 *     role: 'developer',
 *     content: 'Focus on performance issues'
 * });
 * ```
 */
export function addMessageToTask(
    taskGenerator: AsyncGenerator<ProviderStreamEvent>,
    message: ResponseInput[0]
): void {
    // Validate inputs
    if (!taskGenerator) {
        throw new Error('Task generator is required');
    }
    
    // Get the messages array for this task
    const messages = activeTaskMessages.get(taskGenerator);
    if (!messages) {
        throw new Error('Task not found or already completed. Messages can only be added to active tasks.');
    }
    
    // Use the internal function
    internalAddMessage(messages, message, 'external');
}

/**
 * Get compacted message history from metamemory
 * 
 * @param state - The final state from a task with metamemory
 * @param options - Optional compaction options
 * @returns Promise of compacted messages or null if metamemory not enabled
 * 
 * @example
 * ```typescript
 * let finalState;
 * for await (const event of runTask(agent, 'Analyze codebase', { metamemoryEnabled: true })) {
 *     if (event.type === 'task_complete') {
 *         finalState = event.finalState;
 *     }
 * }
 * 
 * // Get compacted history
 * const compacted = await getCompactedHistory(finalState);
 * if (compacted) {
 *     console.log(`Compacted ${compacted.metadata.originalCount} messages to ${compacted.metadata.compactedCount}`);
 * }
 * ```
 */
export async function getCompactedHistory(
    state: TaskEvent['finalState']
): Promise<any> {
    if (!state.metamemoryEnabled || !state.metamemoryState) {
        return null;
    }
    
    // Need to pass an agent for the new metamemory implementation
    // This is a limitation of the current design - we need an agent to compact history
    throw new Error('getCompactedHistory is not supported with the new metamemory implementation. Use metamemory through runTask instead.');
}

/**
 * Check if metamemory has processed enough messages for meaningful compaction
 * 
 * @param state - The final state from task completion
 * @returns true if metamemory is ready for compaction
 */
export function isMetamemoryReady(state: TaskEvent['finalState']): boolean {
    if (!state.metamemoryEnabled || !state.metamemoryState) {
        return false;
    }
    
    const totalMessages = state.messages.filter(m => m.type === 'message').length;
    const processedMessages = state.metamemoryState.lastProcessedIndex || 0;
    
    // Consider ready if at least 50% of messages are processed
    return processedMessages / totalMessages >= 0.5;
}

