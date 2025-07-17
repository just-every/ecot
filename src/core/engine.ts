/**
 * Task Engine - Simplified Version
 *
 * Task implementation for LLM orchestration.
 * Provides meta-cognition and thought delays on top of ensemble.
 * Model rotation is handled by ensemble automatically.
 */

import { getThoughtDelay, runThoughtDelayWithController } from './thought_utils.js';
import type { TaskLocalState } from '../types/task-state.js';
import type { TaskStartEvent, TaskCompleteEvent, TaskFatalErrorEvent, TaskEvent, MetaMemoryEvent, MetaCognitionEvent } from '../types/events.js';
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
import { Metamemory } from '../metamemory/index.js';
import { spawnMetaThought } from '../metacognition/index.js';
import { v4 as uuidv4 } from 'uuid';

// Type alias for all possible event types from runTask
type TaskStreamEvent = ProviderStreamEvent | TaskStartEvent | TaskCompleteEvent | TaskFatalErrorEvent | MetaMemoryEvent | MetaCognitionEvent;

// WeakMap to store message arrays for active tasks
const activeTaskMessages = new WeakMap<AsyncGenerator<TaskStreamEvent>, ResponseInput>();

// Map to track cleanup functions for generators
const generatorCleanup = new WeakMap<AsyncGenerator<TaskStreamEvent>, () => void>();

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
): AsyncGenerator<ProviderStreamEvent | TaskStartEvent | TaskCompleteEvent | TaskFatalErrorEvent | MetaMemoryEvent | MetaCognitionEvent> {
    // If new content provided, add it to messages
    const messages = finalState.messages || [];
    if (newContent && messages) {
        messages.push({
            type: 'message',
            role: 'user',
            content: newContent,
            id: uuidv4()
        });
    }

    // Resume with the full state
    return runTask(agent, newContent || 'Continue with the task', finalState);
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
    taskLocalState?: TaskLocalState
): AsyncGenerator<ProviderStreamEvent | TaskStartEvent | TaskCompleteEvent | TaskFatalErrorEvent | MetaMemoryEvent | MetaCognitionEvent> {
    // Basic validation
    if (!agent || typeof agent !== 'object') {
        throw new Error('Agent must be a valid Agent instance');
    }
    if (!content || typeof content !== 'string' || content.trim().length === 0) {
        throw new Error('Content must be a non-empty string');
    }

    if(!taskLocalState?.runIndefinitely) {
        // Build initial messages with tool guidance
        const toolGuidance = 'You must complete tasks by using the provided tools. When you have finished a task, you MUST call the task_complete() tool with a comprehensive result. If you cannot complete the task, you MUST call the task_fatal_error() tool with an explanation. Do not just provide a final answer without using these tools.';

        // Check if agent instructions already contain task_complete guidance
        if(!agent.instructions?.includes('task_complete')) {
            agent.instructions = agent.instructions ? `${agent.instructions}\n\n${toolGuidance}` : toolGuidance;
        }
    }

    // Use provided messages or create new ones
    const messages: ResponseInput = taskLocalState?.messages ? [...taskLocalState.messages] : [
        {
            type: 'message',
            role: 'user',
            content,
            id: uuidv4()
        }
    ];

    // Create wrapper to handle cleanup
    async function* taskGenerator() {
        const startTime = Date.now();
        const taskId = uuidv4();
        let taskStartEmitted = false;
        let taskCompleted = false;

        // Add Task tools to the agent
        const taskTools = taskLocalState?.runIndefinitely ? [] : getTaskTools();

        // Clone agent to get AgentDefinition and add Task tools
        const agentDef = cloneAgent(agent);
        agentDef.tools = [...taskTools, ...(agent.tools || [])];

        // If resuming with existing messages, check if we already have system instructions
        if (taskLocalState?.messages && taskLocalState.messages.length > 0) {
            // Look for any system message in the history
            const hasSystemMessage = taskLocalState.messages.some(msg => {
                if (msg.type === 'message' && msg.role === 'system' && agent.instructions) {
                    // Check if content is a string and contains instructions
                    const content = msg.content;
                    if (typeof content === 'string') {
                        return content.includes(agent.instructions);
                    }
                }
                return false;
            });

            if (hasSystemMessage) {
                // Clear instructions from agent since they're already in the message history
                // This prevents duplicate system messages
                agentDef.instructions = undefined;
                console.log('[Task] Cleared agent instructions to prevent duplicates when resuming');
            }
        }

        // Track completion state
        let isComplete = false;

        taskLocalState = taskLocalState || {};
        taskLocalState.requestCount = taskLocalState?.requestCount || 0;
        taskLocalState.delayAbortController = taskLocalState?.delayAbortController || new AbortController();

        taskLocalState.cognition = taskLocalState?.cognition || {};
        taskLocalState.cognition.frequency = taskLocalState?.cognition?.frequency || 10;
        taskLocalState.cognition.thoughtDelay = taskLocalState?.cognition?.thoughtDelay || getThoughtDelay();
        taskLocalState.cognition.disabledModels = taskLocalState?.cognition?.disabledModels || new Set();
        taskLocalState.cognition.modelScores = taskLocalState?.cognition?.modelScores || {};

        taskLocalState.memory = taskLocalState?.memory || {};
        taskLocalState.memory.enabled = taskLocalState?.memory?.enabled || true;
        taskLocalState.memory.state = taskLocalState?.memory?.state || {
            topicTags: new Map(),
            taggedMessages: new Map(),
            lastProcessedIndex: 0,
        };
        taskLocalState.memory.processing = taskLocalState?.memory?.processing || false;

        // Initialize metamemory if enabled
        let metamemory: Metamemory | undefined;
        if (taskLocalState.memory.enabled) {
            metamemory = new Metamemory({
                agent,
            });

            // Restore previous state if available
            if (taskLocalState.memory.state) {
                metamemory.restoreState(taskLocalState.memory.state);
                console.log('[Task] Restored metamemory state with',
                    taskLocalState.memory.state.topicTags?.size || 0, 'topics and',
                    taskLocalState.memory.state.taggedMessages?.size || 0, 'tagged messages');
            }
        }

        // Queue for events generated asynchronously
        const asyncEventQueue: (MetaMemoryEvent | MetaCognitionEvent)[] = [];

        // Track pending async operations
        const pendingAsyncOps = new Set<Promise<void>>();

        try {
            //console.log(`[Task] Starting execution for agent: ${agent.name}`);

            // Emit task_start event
            if (!taskLocalState?.runIndefinitely) {
                const taskStartEvent: TaskStartEvent = {
                    type: 'task_start',
                    task_id: taskId,
                    finalState: {
                        ...taskLocalState
                    }
                };
                yield taskStartEvent;
                taskStartEmitted = true;
            }

            while (!isComplete) {
                // Wait if ensemble is paused (before any processing)
                await waitWhilePaused();

                // Apply thought delay
                if (taskLocalState.requestCount > 1) {
                    const delay = taskLocalState.cognition.thoughtDelay;
                    if (delay > 0) {
                        await runThoughtDelayWithController(taskLocalState.delayAbortController, delay);
                    }
                }

                // Increment task-local request counter for meta-cognition
                taskLocalState.requestCount++;
                console.log(`[Task] Request count: ${taskLocalState.requestCount}, Meta frequency: ${taskLocalState.cognition.frequency}`);

                // Check for any async events to yield first
                while (asyncEventQueue.length > 0) {
                    const asyncEvent = asyncEventQueue.shift()!;
                    yield asyncEvent;
                }

                // Check meta-cognition triggers
                const metaFrequency = taskLocalState.cognition.frequency;
                let shouldTriggerMetacognition = false;
                
                // Trigger 1: Regular frequency-based trigger
                if (taskLocalState.requestCount > 0 && taskLocalState.requestCount % metaFrequency === 0 && !taskLocalState.cognition.processing) {
                    console.log(`[Task] Metacognition frequency trigger: request ${taskLocalState.requestCount} is divisible by ${metaFrequency}`);
                    shouldTriggerMetacognition = true;
                }
                
                // Trigger 2: Topic change detection (using metamemory)
                if (!shouldTriggerMetacognition && taskLocalState.memory.state && taskLocalState.requestCount > 2) {
                    // Get recent messages to check for topic changes
                    const recentMessages = messages.slice(-3);
                    const recentTopics = new Set<string>();
                    
                    // Collect topics from recent messages
                    for (const msg of recentMessages) {
                        if (msg.id && taskLocalState.memory.state.taggedMessages.has(msg.id)) {
                            const metadata = taskLocalState.memory.state.taggedMessages.get(msg.id);
                            if (metadata) {
                                metadata.topic_tags.forEach(tag => recentTopics.add(tag));
                            }
                        }
                    }
                    
                    // Check if we have active topics in recent messages
                    const activeTopics = Array.from(taskLocalState.memory.state.topicTags.entries())
                        .filter(([_, meta]) => meta.type === 'active')
                        .map(([tag, _]) => tag);
                    
                    // If no recent topics overlap with active topics, we might have switched topics
                    const hasTopicSwitch = activeTopics.length > 0 && 
                        activeTopics.every(topic => !recentTopics.has(topic));
                    
                    if (hasTopicSwitch && !taskLocalState.cognition.processing) {
                        console.log('[Task] Detected topic switch, triggering metacognition');
                        shouldTriggerMetacognition = true;
                    }
                }
                
                if (shouldTriggerMetacognition) {
                    //console.log(`[Task] Triggering meta-cognition after ${taskLocalState.requestCount} requests`);

                    // Emit metacognition start event
                    // Convert Set to array for JSON serialization
                    const serializedCognitionState = taskLocalState?.cognition ? {
                        ...taskLocalState.cognition,
                        disabledModels: taskLocalState.cognition.disabledModels ?
                            Array.from(taskLocalState.cognition.disabledModels) : undefined
                    } : undefined;

                    const metaStartEvent: MetaCognitionEvent = {
                        type: 'metacognition_event',
                        operation: 'analysis_start',
                        eventId: uuidv4(), // Unique ID for the event
                        data: {
                            requestCount: taskLocalState.requestCount,
                            state: serializedCognitionState
                        },
                        timestamp: Date.now()
                    };
                    yield metaStartEvent;

                    // Mark as processing to prevent concurrent runs
                    taskLocalState.cognition.processing = true;

                    // Fire and forget - process in background with timeout
                    const processingStart = Date.now();
                    const COGNITION_TIMEOUT = 3 * 60 * 1000; // 3 minutes

                    const cognitionPromise = spawnMetaThought(agentDef, messages, new Date(startTime), taskLocalState.requestCount, taskLocalState);
                    const timeoutPromise = new Promise<never>((_, reject) =>
                        setTimeout(() => reject(new Error('Meta-cognition processing timeout after 3 minutes')), COGNITION_TIMEOUT)
                    );

                    const cognitionOp = Promise.race([cognitionPromise, timeoutPromise]).then((result) => {
                        const processingTime = Math.round((Date.now() - processingStart) / 1000);

                        // Emit metacognition complete event
                        // Convert Set to array for JSON serialization
                        const serializedCompleteCognitionState = taskLocalState?.cognition ? {
                            ...taskLocalState.cognition,
                            disabledModels: taskLocalState.cognition.disabledModels ?
                                Array.from(taskLocalState.cognition.disabledModels) : undefined
                        } : undefined;

                        const metaCompleteEvent: MetaCognitionEvent = {
                            type: 'metacognition_event',
                            operation: 'analysis_complete',
                            eventId: metaStartEvent.eventId, // Unique ID for the event
                            data: {
                                requestCount: taskLocalState?.requestCount || 0,
                                processingTime: processingTime * 1000,
                                ...result,
                                state: serializedCompleteCognitionState
                            },
                            timestamp: Date.now()
                        };
                        asyncEventQueue.push(metaCompleteEvent);

                        console.log(`[Task] Meta-cognition background processing completed in ${processingTime}s`);
                    }).catch(error => {
                        const isTimeout = error.message?.includes('timeout');
                        console.error(`[Task] ${isTimeout ? 'Timeout' : 'Error'} in meta-cognition background processing:`, error);
                    }).finally(() => {
                        if (taskLocalState?.cognition) {
                            taskLocalState.cognition.processing = false;
                        }
                        pendingAsyncOps.delete(cognitionOp);
                    });

                    // Track this operation
                    pendingAsyncOps.add(cognitionOp);
                }

                // Compact messages before ensemble request if metamemory is enabled
                let messagesToProcess = messages;
                if (metamemory && taskLocalState.memory.enabled) {
                    try {
                        messagesToProcess = metamemory.compact([...messages]);
                    } catch (error) {
                        console.error('[Task] Error compacting messages:', error);
                        messagesToProcess = messages; // Fall back to original messages
                    }
                }

                // Run ensemble request and yield all events
                for await (const event of ensembleRequest(messagesToProcess, agentDef)) {
                    // Check for any async events that were queued
                    while (asyncEventQueue.length > 0) {
                        const asyncEvent = asyncEventQueue.shift()!;
                        yield asyncEvent;
                    }

                    // Yield the event to the caller
                    yield event;

                    // Handle tool calls
                    if (event.type === 'tool_done' && 'result' in event) {
                        const toolEvent = event as any;
                        const toolName = toolEvent.tool_call?.function?.name;

                        if (!taskLocalState?.runIndefinitely && (toolName === 'task_complete' || toolName === 'task_fatal_error')) {
                            isComplete = true;
                            taskCompleted = true;
                            // Emit task_complete or task_fatal_error event with final state
                            const completeEvent: TaskCompleteEvent | TaskFatalErrorEvent = {
                                type: toolName as 'task_complete' | 'task_fatal_error',
                                task_id: taskId,
                                result: toolEvent.result?.output || '',
                                finalState: {
                                    ...taskLocalState
                                }
                            };
                            yield completeEvent;
                        }
                    }
                    else if (event.type === 'response_output') {
                        const responseEvent = event as any;
                        if (responseEvent.message) {
                            if(!responseEvent.message.id) {
                                responseEvent.message.id = uuidv4();
                            }
                            messages.push(responseEvent.message);

                            // Process with metamemory if enabled
                            if (metamemory && taskLocalState.memory.state && taskLocalState.memory.enabled && !taskLocalState.memory.processing) {
                                // Emit metamemory tagging started event
                                // Include current state if available
                                const startEventData: any = {
                                    messageCount: messages.length
                                };

                                if (taskLocalState.memory.state) {
                                    // Convert Maps to objects for JSON serialization
                                    startEventData.state = {
                                        topicTags: Object.fromEntries(taskLocalState.memory.state.topicTags),
                                        taggedMessages: Object.fromEntries(taskLocalState.memory.state.taggedMessages),
                                        topicCompaction: taskLocalState.memory.state.topicCompaction ?
                                            Object.fromEntries(taskLocalState.memory.state.topicCompaction) : undefined,
                                        lastProcessedIndex: taskLocalState.memory.state.lastProcessedIndex
                                    };
                                }

                                const metaStartEvent: MetaMemoryEvent = {
                                    type: 'metamemory_event',
                                    operation: 'tagging_start',
                                    eventId: uuidv4(), // Unique ID for the event
                                    data: startEventData,
                                    timestamp: Date.now()
                                };
                                yield metaStartEvent;

                                // Mark as processing to prevent concurrent runs
                                taskLocalState.memory.processing = true;

                                // Fire and forget - process in background with timeout
                                const processingStart = Date.now();
                                const MEMORY_TIMEOUT = 3 * 60 * 1000; // 3 minutes

                                const memoryPromise = metamemory.processMessages([...messages]);
                                const timeoutPromise = new Promise<void>((_, reject) =>
                                    setTimeout(() => reject(new Error('Metamemory processing timeout after 3 minutes')), MEMORY_TIMEOUT)
                                );

                                const memoryOp = Promise.race([memoryPromise, timeoutPromise]).then(async (result) => {
                                    const processingTime = Math.round((Date.now() - processingStart) / 1000);
                                    if (taskLocalState?.memory) {
                                        taskLocalState.memory.state = metamemory.getState();
                                        console.log(`[Task] Metamemory background processing completed in ${processingTime}s`);

                                        // Check for compaction after processing
                                        try {
                                            await metamemory.checkCompact([...messages]);
                                        } catch (error) {
                                            console.error('[Task] Error checking compaction:', error);
                                        }

                                        // Create processing complete event
                                        // Convert Maps to objects for JSON serialization
                                        const stateForSerialization = {
                                            topicTags: Object.fromEntries(taskLocalState.memory.state.topicTags),
                                            taggedMessages: Object.fromEntries(taskLocalState.memory.state.taggedMessages),
                                            topicCompaction: taskLocalState.memory.state.topicCompaction ?
                                                Object.fromEntries(taskLocalState.memory.state.topicCompaction) : undefined,
                                            lastProcessedIndex: taskLocalState.memory.state.lastProcessedIndex
                                        };

                                        const completeEvent: MetaMemoryEvent = {
                                            type: 'metamemory_event',
                                            operation: 'tagging_complete',
                                            eventId: metaStartEvent.eventId, // Unique ID for the event
                                            data: {
                                                messageCount: messages.length,
                                                processingTime: processingTime * 1000,
                                                state: stateForSerialization,
                                                ...result,
                                            },
                                            timestamp: Date.now()
                                        };
                                        asyncEventQueue.push(completeEvent);
                                    }
                                }).catch(error => {
                                    const isTimeout = error.message?.includes('timeout');
                                    console.error(`[Task] ${isTimeout ? 'Timeout' : 'Error'} in metamemory background processing:`, error);
                                }).finally(() => {
                                    if (taskLocalState?.memory) {
                                        taskLocalState.memory.processing = false;
                                    }
                                    pendingAsyncOps.delete(memoryOp);
                                });

                                // Track this operation
                                pendingAsyncOps.add(memoryOp);
                            }
                        }
                    }
                }

                // Check for any async events that were queued during processing
                while (asyncEventQueue.length > 0) {
                    const asyncEvent = asyncEventQueue.shift()!;
                    yield asyncEvent;
                }
            }

            // Wait for all pending async operations to complete
            if (pendingAsyncOps.size > 0) {
                console.log(`[Task] Waiting for ${pendingAsyncOps.size} async operations to complete...`);

                // Set a maximum wait time for all async operations
                const MAX_WAIT_TIME = 5 * 60 * 1000; // 5 minutes
                const allOpsPromise = Promise.all(Array.from(pendingAsyncOps));
                const waitTimeoutPromise = new Promise<void>((resolve) =>
                    setTimeout(() => {
                        console.warn('[Task] Timeout waiting for async operations, continuing...');
                        resolve();
                    }, MAX_WAIT_TIME)
                );

                await Promise.race([allOpsPromise, waitTimeoutPromise]);

                // Yield any remaining async events
                while (asyncEventQueue.length > 0) {
                    const asyncEvent = asyncEventQueue.shift()!;
                    yield asyncEvent;
                }
            }

        } catch (error) {
            console.error('[Task] Error running agent:', error);

            // If task_start was emitted but no completion event, emit task_fatal_error
            if (taskStartEmitted && !taskCompleted && !taskLocalState?.runIndefinitely) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                const errorEvent: TaskFatalErrorEvent = {
                    type: 'task_fatal_error',
                    task_id: taskId,
                    result: `Task failed with error: ${errorMessage}`,
                    finalState: {
                        ...taskLocalState
                    }
                };
                yield errorEvent;
                taskCompleted = true;
            }

            // Yield an error event
            const errorMessage = error instanceof Error ? error.message : String(error);
            yield {
                type: 'error' as const,
                error: new Error(`Agent execution failed: ${errorMessage}`)
            } as ProviderStreamEvent;
        } finally {
            // Yield any remaining async events
            while (asyncEventQueue.length > 0) {
                const asyncEvent = asyncEventQueue.shift()!;
                yield asyncEvent;
            }

            // Ensure task completion event is always emitted if task_start was emitted
            if (taskStartEmitted && !taskCompleted && !taskLocalState?.runIndefinitely) {
                const errorEvent: TaskFatalErrorEvent = {
                    type: 'task_fatal_error',
                    task_id: taskId,
                    result: 'Task ended without explicit completion',
                    finalState: {
                        ...taskLocalState
                    }
                };
                yield errorEvent;
            }
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
    const wrappedGenerator = (async function* (): AsyncGenerator<TaskStreamEvent> {
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
    source: 'external' | 'metacognition' = 'external'
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
    console.log(
        `[Task] ${source === 'metacognition' ? 'Metacognition' : 'External'} message added with role: ${message.role}`
    );
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