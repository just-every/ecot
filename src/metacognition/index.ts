/**
 * metacognition module for Task
 *
 * This module implements "thinking about thinking" capabilities for the Task system.
 * It spawns an LLM agent that analyzes recent thought history and can adjust system
 * parameters to improve performance.
 */

import { getThoughtDelay } from '../core/thought_utils.js';
import { internalAddMessage } from '../core/engine.js';
import {
    ResponseInput,
    Agent,
    ensembleRequest,
    createToolFunction,
    truncateLargeValues,
    type ToolFunction
} from '@just-every/ensemble';
import { VALID_FREQUENCIES } from '../utils/constants.js';
import type { TaskLocalState } from '../types/task-state.js';

/**
 * Get all metacognition tools as an array of tool definitions
 * These are available only to the metacognition agent, not the main agent
 */
function getMetaCognitionTools(mainMessages: ResponseInput, taskLocalState: TaskLocalState): ToolFunction[] {
    const tools: ToolFunction[] = [];

    // Create named functions for better debugging and testing
    function inject_thought(content: string) {
        // Add thought to the main messages array for next iteration
        internalAddMessage(
            mainMessages,
            {
                type: 'message',
                role: 'developer',
                content: `**IMPORTANT - METACOGNITION:** ${content}`,
            },
            'metacognition'
        );
        return `Successfully injected metacognition thought at ${new Date().toISOString()}`;
    }

    function no_changes_needed(): string {
        console.log('[Task] metacognition no change');
        return 'No changes made';
    }

    // Task-local versions of state modification functions
    function set_task_meta_frequency(frequency: string): string {
        const numFreq = parseInt(frequency);
        if (!VALID_FREQUENCIES.includes(numFreq as any)) {
            throw new Error(`Invalid frequency: ${frequency}. Must be one of: ${VALID_FREQUENCIES.join(', ')}`);
        }
        taskLocalState.cognition = taskLocalState.cognition || {};
        taskLocalState.cognition.frequency = numFreq;
        console.log(`[Task] Meta-cognition frequency set to ${numFreq} for this task`);
        return taskLocalState.cognition.frequency.toString();
    }

    function set_task_model_score(modelId: string, score: number): string {
        if (score < 0 || score > 100) {
            throw new Error(`Score must be between 0 and 100, got ${score}`);
        }
        taskLocalState.cognition = taskLocalState.cognition || {};
        taskLocalState.cognition.modelScores = taskLocalState.cognition.modelScores || {};
        taskLocalState.cognition.modelScores[modelId] = score;
        console.log(`[Task] Model ${modelId} score set to ${score} for this task`);
        return `Model ${modelId} score set to ${score}`;
    }

    function disable_task_model(modelId: string, disabled: boolean = true): string {
        if (disabled) {
            taskLocalState.cognition = taskLocalState.cognition || {};
            taskLocalState.cognition.disabledModels = taskLocalState.cognition.disabledModels || new Set();
            taskLocalState.cognition.disabledModels.add(modelId);
            console.log(`[Task] Model ${modelId} disabled for this task`);
            return `Model ${modelId} has been disabled`;
        } else {
            taskLocalState.cognition = taskLocalState.cognition || {};
            taskLocalState.cognition.disabledModels = taskLocalState.cognition.disabledModels || new Set();
            taskLocalState.cognition.disabledModels.delete(modelId);
            console.log(`[Task] Model ${modelId} enabled for this task`);
            return `Model ${modelId} has been enabled`;
        }
    }

    function set_task_thought_delay(delay: string): string {
        const numDelay = parseInt(delay);
        const validDelays = [0, 2, 4, 8, 16, 32, 64, 128];
        if (!validDelays.includes(numDelay)) {
            throw new Error(`Invalid delay: ${delay}. Must be one of: ${validDelays.join(', ')}`);
        }
        taskLocalState.cognition = taskLocalState.cognition || {};
        taskLocalState.cognition.thoughtDelay = numDelay;
        console.log(`[Task] Thought delay set to ${numDelay} seconds for this task`);
        return `Thought delay set to ${numDelay} seconds`;
    }

    tools.push(
        createToolFunction(
            inject_thought,
            'Your core tool for altering the thought process of the agent. Injects a thought with high priority into the next loop for the agent. The agent will see this before choosing their next thought or action.',
            {
                content: 'The thought to inject. Be detailed and explain why this is important.',
            },
            undefined,
            'inject_thought'
        ),
        createToolFunction(
            set_task_meta_frequency,
            'Change how often metacognition should run (every N LLM requests) for this task',
            {
                frequency: {
                    type: 'string',
                    description: 'Frequency value (5, 10, 20, or 40 LLM requests)',
                    enum: VALID_FREQUENCIES as unknown as string[],
                },
            },
            undefined,
            'set_meta_frequency'
        ),
        createToolFunction(
            set_task_model_score,
            'Set a score for a specific model (affects selection frequency) for this task',
            {
                modelId: 'The model ID to score',
                score: 'Score between 0-100, higher means the model is selected more often',
            },
            undefined,
            'set_model_score'
        ),
        createToolFunction(
            disable_task_model,
            'Temporarily disable a model from being selected for this task. Pass disabled=false to enable it again.',
            {
                modelId: 'The model ID to change',
                disabled: {
                    type: 'boolean',
                    description: 'Whether to disable the model (true) or enable it (false)',
                    optional: true,
                    default: true,
                },
            },
            undefined,
            'disable_model'
        ),
        createToolFunction(
            set_task_thought_delay,
            'Change the delay between agent thoughts for this task',
            {
                delay: {
                    type: 'string',
                    description: 'Delay in seconds (0, 2, 4, 8, 16, 32, 64, or 128)',
                    enum: ['0', '2', '4', '8', '16', '32', '64', '128'],
                },
            },
            undefined,
            'set_thought_delay'
        ),
        createToolFunction(
            no_changes_needed,
            'Everything is perfect. Use when no other tools are needed.',
            {},
            undefined,
            'no_changes_needed'
        ),
    );

    return tools;
}

/**
 * Spawn a metacognition process to analyze and optimize agent performance
 *
 * Metacognition is Task's "thinking about thinking" capability. It:
 * - Analyzes recent agent thoughts and tool usage patterns
 * - Identifies inefficiencies, errors, and optimization opportunities
 * - Can adjust system parameters (model scores, meta frequency, thought delay)
 * - Injects strategic guidance into the agent's thought process
 *
 * The metacognition agent has access to specialized tools for system tuning
 * and runs on high-quality reasoning models for optimal analysis.
 *
 * @param agent - The main agent being analyzed
 * @param messages - The conversation history
 * @param startTime - When the current task execution began (for performance analysis)
 *
 * @throws {TypeError} If any required parameters are invalid
 *
 * @example
 * ```typescript
 * // Triggered automatically based on meta frequency
 * await spawnMetaThought(agent, messages, taskStartTime);
 *
 * // Metacognition might result in:
 * // - Model score adjustments
 * // - Injected strategic thoughts
 * // - Changed meta frequency
 * // - Disabled underperforming models
 * ```
 */
export async function spawnMetaThought(
    parent: { agent_id?: string; name?: string },
    messages: ResponseInput,
    startTime: Date,
    taskRequestCount: number,
    taskLocalState: TaskLocalState
): Promise<{ adjustments?: string[], injectedThoughts?: string[] }> {
    // Validate inputs
    if (!parent || typeof parent !== 'object') {
        throw new TypeError('[Task] Invalid agent for metacognition');
    }

    if (!messages || !Array.isArray(messages)) {
        throw new TypeError('[Task] Invalid messages for metacognition');
    }

    if (!startTime || !(startTime instanceof Date)) {
        throw new TypeError('[Task] Invalid startTime for metacognition');
    }

    console.log('[Task] Spawning metacognition process');

    try {
        // Create a metacognition agent
        const metaAgent = new Agent({
            name: 'MetaCognitionAnalyzer',
            parent_id: parent.agent_id,
            instructions: `Your role is to perform **Metacognition** for the agent named **${parent.name || 'Unknown'}**.

You "think about thinking"! Studies show that the best problem solvers in the world use metacognition frequently. The ability to think about one's own thinking processes, allows individuals to plan, monitor, and regulate their approach to problem-solving, leading to more successful outcomes. Metacognition helps you improve your problem-solving skills by making you more aware, reflective, and strategic.

Though metacognition, you continuously improve ${parent.name || 'the agent'}'s performance, analyzing recent activity and adjusting to its configuration or reasoning strategy.

System State:
- Runtime: ${Math.round((Date.now() - startTime.getTime()) / 1000)} seconds
- Task LLM Requests: ${taskRequestCount}
- Meta Frequency: Every ${taskLocalState?.cognition?.frequency} requests
- Thought Delay: ${taskLocalState?.cognition?.thoughtDelay || getThoughtDelay()} seconds
- Disabled Models: ${taskLocalState?.cognition?.disabledModels ? Array.from(taskLocalState.cognition.disabledModels).join(', ') : 'None'}
- Model Scores: ${taskLocalState?.cognition?.modelScores ? Object.entries(taskLocalState.cognition.modelScores).map(([id, score]) => `${id}: ${score}`).join(', ') : 'None'}

Recent history shows ${messages.length} messages.

Analyze the agent's recent thoughts and:
1. Identify any inefficiencies, errors, or optimization opportunities
2. Consider adjusting model scores, meta frequency, or thought delay
3. If needed, inject strategic guidance to improve performance
4. Use the no_changes_needed tool if everything is already optimal

Be concise and strategic in your analysis.`,
            tools: [...getMetaCognitionTools(messages, taskLocalState)],
            modelClass: 'reasoning',
            tags: ['background', 'cognition'],
            modelSettings: {
                tool_choice: 'required'
            },
            maxToolCallRoundsPerTurn: 1
        });

        // Create meta messages with recent history summary
        const analyzeCount = (taskLocalState?.cognition?.frequency || 0) + 20;
        const recentHistory = messages.slice(-1 * analyzeCount);

        const metaMessages: ResponseInput = [];

        if (recentHistory.length === 0) {
            throw new Error('[Task] No recent messages to analyze for metacognition');
        }

        let formattedMessages = 'Recent Messages to Analyze:\n\n';
        for (const msg of recentHistory) {
            formattedMessages += `---\n\n`;
            if(msg.id) {
                formattedMessages += `Message ID: ${msg.id}\n`;
            }
            if(msg.type) {
                formattedMessages += `Type: ${msg.type}\n`;
            }
            if(msg.model) {
                formattedMessages += `Model: ${msg.model}\n`;
            }
            if(msg.timestamp) {
                formattedMessages += `Time: ${msg.timestamp}\n`;
            }
            // Create a copy of the message without the already-extracted fields
            const { id, type, model, timestamp, ...messageWithoutExtracted } = msg;
            formattedMessages += `Full Message:\n${JSON.stringify(truncateLargeValues(messageWithoutExtracted), null, 2)}\n\n`;
        }

        metaMessages.push({
            type: 'message',
            role: 'user',
            content: formattedMessages.trim(),
        });

        // Track adjustments made
        const adjustments: string[] = [];
        const injectedThoughts: string[] = [];

        // Run metacognition request - ensemble will handle model selection with modelClass
        for await (const event of ensembleRequest(metaMessages, metaAgent)) {
            // Log metacognition responses
            if (event.type === 'message_delta' && 'content' in event) {
                //console.log('[Task:META]', event.content);
            }

            // Capture tool calls to track adjustments
            if (event.type === 'tool_done' && 'tool_call' in event && event.tool_call) {
                const toolName = event.tool_call.function?.name;
                const args = event.tool_call.function?.arguments;

                switch (toolName) {
                    case 'inject_thought':
                        adjustments.push(`Injected thought`);
                        const injectArgs = args as any;
                        if (injectArgs?.content) {
                            injectedThoughts.push(injectArgs?.content);
                        }
                        break;
                    case 'set_meta_frequency':
                        const freqArgs = args as any;
                        if (freqArgs?.frequency) {
                            adjustments.push(`Changed meta frequency to ${freqArgs.frequency}`);
                        }
                        break;
                    case 'set_thought_delay':
                        const delayArgs = args as any;
                        if (delayArgs?.seconds) {
                            adjustments.push(`Changed thought delay to ${delayArgs.seconds}s`);
                        }
                        break;
                    case 'disable_model':
                        const disableArgs = args as any;
                        if (disableArgs?.model_id) {
                            adjustments.push(`Disabled model ${disableArgs.model_id}`);
                        }
                        break;
                    case 'adjust_model_score':
                        const scoreArgs = args as any;
                        if (scoreArgs?.model_id && scoreArgs?.score) {
                            adjustments.push(`Adjusted ${scoreArgs.model_id} score to ${scoreArgs.score}`);
                        }
                        break;
                    case 'no_changes_needed':
                        // No changes made!
                        break;
                }
            }
        }

        console.log('[Task] Metacognition process completed', adjustments);
        return { adjustments, injectedThoughts };
    } catch (error) {
        console.error('[Task] Error in metacognition:', error);
        throw error;
    }
}