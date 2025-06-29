/**
 * metacognition module for Task
 *
 * This module implements "thinking about thinking" capabilities for the Task system.
 * It spawns an LLM agent that analyzes recent thought history and can adjust system
 * parameters to improve performance.
 */

import {
    taskState,
    listDisabledModels,
    listModelScores
} from '../state/state.js';
import { getThoughtDelay } from './thought_utils.js';
import { internalAddMessage } from './engine.js';
import { 
    ResponseInput, 
    Agent,
    ensembleRequest,
    createToolFunction,
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
        if (!VALID_FREQUENCIES.includes(frequency as any)) {
            throw new Error(`Invalid frequency: ${frequency}. Must be one of: ${VALID_FREQUENCIES.join(', ')}`);
        }
        taskLocalState.metaFrequency = frequency;
        console.log(`[Task] Meta-cognition frequency set to ${frequency} for this task`);
        return taskLocalState.metaFrequency;
    }
    
    function set_task_model_score(modelId: string, score: number): string {
        if (score < 0 || score > 100) {
            throw new Error(`Score must be between 0 and 100, got ${score}`);
        }
        taskLocalState.modelScores[modelId] = score;
        console.log(`[Task] Model ${modelId} score set to ${score} for this task`);
        return `Model ${modelId} score set to ${score}`;
    }
    
    function disable_task_model(modelId: string, disabled: boolean = true): string {
        if (disabled) {
            taskLocalState.disabledModels.add(modelId);
            console.log(`[Task] Model ${modelId} disabled for this task`);
            return `Model ${modelId} has been disabled`;
        } else {
            taskLocalState.disabledModels.delete(modelId);
            console.log(`[Task] Model ${modelId} enabled for this task`);
            return `Model ${modelId} has been enabled`;
        }
    }
    
    function set_task_thought_delay(delay: string): string {
        const validDelays = ['0', '2', '4', '8', '16', '32', '64', '128'];
        if (!validDelays.includes(delay)) {
            throw new Error(`Invalid delay: ${delay}. Must be one of: ${validDelays.join(', ')}`);
        }
        taskLocalState.thoughtDelay = delay;
        console.log(`[Task] Thought delay set to ${delay} seconds for this task`);
        return `Thought delay set to ${delay} seconds`;
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
    agent: { agent_id?: string; name?: string }, 
    messages: ResponseInput,
    startTime: Date,
    taskRequestCount?: number,
    taskLocalState?: TaskLocalState
): Promise<void> {
    // Validate inputs
    if (!agent || typeof agent !== 'object') {
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
            name: 'MetacognitionAgent',
            agent_id: agent.agent_id,
            instructions: `Your role is to perform **Metacognition** for the agent named **${agent.name || 'Unknown'}**.

You "think about thinking"! Studies show that the best problem solvers in the world use metacognition frequently. The ability to think about one's own thinking processes, allows individuals to plan, monitor, and regulate their approach to problem-solving, leading to more successful outcomes. Metacognition helps you improve your problem-solving skills by making you more aware, reflective, and strategic.

Though metacognition, you continuously improve ${agent.name || 'the agent'}'s performance, analyzing recent activity and adjusting to its configuration or reasoning strategy.

System State:
- Runtime: ${Math.round((Date.now() - startTime.getTime()) / 1000)} seconds
- Task LLM Requests: ${taskRequestCount || 'Unknown'}
- Meta Frequency: Every ${taskLocalState?.metaFrequency || taskState.metaFrequency} requests
- Thought Delay: ${taskLocalState?.thoughtDelay || getThoughtDelay()} seconds
- Disabled Models: ${taskLocalState ? Array.from(taskLocalState.disabledModels).join(', ') || 'None' : listDisabledModels()}
- Model Scores: ${taskLocalState ? Object.entries(taskLocalState.modelScores).map(([id, score]) => `${id}: ${score}`).join(', ') || 'None set' : listModelScores()}

Recent history shows ${messages.length} messages.

Analyze the agent's recent thoughts and:
1. Identify any inefficiencies, errors, or optimization opportunities
2. Consider adjusting model scores, meta frequency, or thought delay
3. If needed, inject strategic guidance to improve performance
4. Use the no_changes_needed tool if everything is already optimal

Be concise and strategic in your analysis.`,
            tools: taskLocalState ? [...getMetaCognitionTools(messages, taskLocalState)] : [...getMetaCognitionTools(messages, { 
                requestCount: 0,
                metaFrequency: taskState.metaFrequency,
                thoughtDelay: getThoughtDelay(),
                disabledModels: new Set(taskState.disabledModels),
                modelScores: { ...taskState.modelScores },
                delayAbortController: new AbortController()
            })],
            modelClass: 'reasoning',
            modelSettings: {
                tool_choice: 'required'
            },
            maxToolCallRoundsPerTurn: 1
        });

        // Create meta messages with recent history summary
        const recentHistory = messages.slice(-10).map((msg: any) => {
            if (msg.type === 'message') {
                return `${msg.role}: ${msg.content?.substring(0, 200)}...`;
            }
            return '';
        }).filter(Boolean).join('\n');

        const metaMessages: ResponseInput = [
            {
                type: 'message',
                role: 'user',
                content: `Analyze the recent agent activity and optimize performance. Recent history:\n\n${recentHistory}`
            }
        ];

        // Run metacognition request - ensemble will handle model selection with modelClass
        for await (const event of ensembleRequest(metaMessages, metaAgent)) {
            // Log metacognition responses
            if (event.type === 'message_delta' && 'content' in event) {
                //console.log('[Task:META]', event.content);
            }
        }

        console.log('[Task] Metacognition process completed');
    } catch (error) {
        console.error('[Task] Error in metacognition:', error);
        throw error;
    }
}