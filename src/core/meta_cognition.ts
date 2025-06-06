/**
 * metacognition module for MECH
 *
 * This module implements "thinking about thinking" capabilities for the MECH system.
 * It spawns an LLM agent that analyzes recent thought history and can adjust system
 * parameters to improve performance.
 */

import {
    mechState,
    listDisabledModels,
    listModelScores,
    setMetaFrequency,
    setModelScore,
    disableModel
} from '../state/state.js';
import { getThoughtDelay, getThoughtTools } from './thought_utils.js';
import { 
    ResponseInput, 
    getModelFromClass, 
    Agent as EnsembleAgent,
    ensembleRequest,
    createToolFunction,
    type ToolFunction,
    type AgentDefinition
} from '@just-every/ensemble';
import { VALID_FREQUENCIES } from '../utils/constants.js';

/**
 * Get all metacognition tools as an array of tool definitions
 * These are available only to the metacognition agent, not the main agent
 */
function getMetaCognitionTools(messages: ResponseInput): ToolFunction[] {
    const tools: ToolFunction[] = [];
    
    // Create named functions for better debugging and testing
    function injectThought(content: string) { 
        // Add thought to messages for next iteration
        messages.push({
            type: 'message',
            role: 'developer',
            content: `**IMPORTANT - METACOGNITION:** ${content}`,
        });
        console.log(`[MECH] metacognition injected thought: ${content}`);
        return `Successfully injected metacognition thought at ${new Date().toISOString()}`;
    }
    
    function noChangesNeeded(): string {
        console.log('[MECH] metacognition no change');
        return 'No changes made';
    }
    
    tools.push(
        createToolFunction(
            injectThought,
            'Your core tool for altering the thought process of the agent. Injects a thought with high priority into the next loop for the agent. The agent will see this before choosing their next thought or action.',
            {
                content: 'The thought to inject. Be detailed and explain why this is important.',
            }
        ),
        createToolFunction(
            setMetaFrequency,
            'Change how often metacognition should run (every N LLM requests)',
            {
                frequency: {
                    type: 'string',
                    description: 'Frequency value (5, 10, 20, or 40 LLM requests)',
                    enum: VALID_FREQUENCIES as unknown as string[],
                },
            },
            'Confirmation message'
        ),
        createToolFunction(
            setModelScore,
            'Set a score for a specific model (affects selection frequency)',
            {
                modelId: 'The model ID to score',
                score: 'Score between 0-100, higher means the model is selected more often',
            },
            'The new score for the model'
        ),
        createToolFunction(
            disableModel,
            'Temporarily disable a model from being selected. Pass disabled=false to enable it again.',
            {
                modelId: 'The model ID to change',
                disabled: {
                    type: 'boolean',
                    description: 'Whether to disable the model (true) or enable it (false)',
                    optional: true,
                    default: true,
                },
            }
        ),
        createToolFunction(
            noChangesNeeded,
            'Everything is perfect. Use when no other tools are needed.'
        ),
    );
    
    return tools;
}

/**
 * Spawn a metacognition process to analyze and optimize agent performance
 * 
 * Metacognition is MECH's "thinking about thinking" capability. It:
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
    agent: Pick<AgentDefinition, 'agent_id' | 'name'>, 
    messages: ResponseInput,
    startTime: Date
): Promise<void> {
    // Validate inputs
    if (!agent || typeof agent !== 'object') {
        throw new TypeError('[MECH] Invalid agent for metacognition');
    }
    
    if (!messages || !Array.isArray(messages)) {
        throw new TypeError('[MECH] Invalid messages for metacognition');
    }
    
    if (!startTime || !(startTime instanceof Date)) {
        throw new TypeError('[MECH] Invalid startTime for metacognition');
    }
    
    console.log('[MECH] Spawning metacognition process');

    try {
        // Create a metacognition agent using provided Agent constructor
        const metaAgent = new EnsembleAgent({
            name: 'MetacognitionAgent',
            agent_id: agent.agent_id,
            instructions: `Your role is to perform **Metacognition** for the agent named **${agent.name}**.

You "think about thinking"! Studies show that the best problem solvers in the world use metacognition frequently. The ability to think about one's own thinking processes, allows individuals to plan, monitor, and regulate their approach to problem-solving, leading to more successful outcomes. Metacognition helps you improve your problem-solving skills by making you more aware, reflective, and strategic.

Though metacognition, you continuously improve ${agent.name}'s performance, analyzing recent activity and adjusting to its configuration or reasoning strategy.

System State:
- Runtime: ${Math.round((Date.now() - startTime.getTime()) / 1000)} seconds
- LLM Requests: ${mechState.llmRequestCount}
- Meta Frequency: Every ${mechState.metaFrequency} requests
- Thought Delay: ${getThoughtDelay()} seconds
- Disabled Models: ${listDisabledModels()}
- Model Scores: ${listModelScores()}

Recent history shows ${messages.length} messages.

Analyze the agent's recent thoughts and:
1. Identify any inefficiencies, errors, or optimization opportunities
2. Consider adjusting model scores, meta frequency, or thought delay
3. If needed, inject strategic guidance to improve performance
4. Use the no_changes_needed tool if everything is already optimal

Be concise and strategic in your analysis.`,
            tools: [...getMetaCognitionTools(messages), ...getThoughtTools()],
            modelClass: 'reasoning',
            modelSettings: {
                tool_choice: 'required'
            }
        });

        // Get model for metacognition
        const metaModel = await getModelFromClass('reasoning');
        if (metaModel) {
            metaAgent.model = metaModel;
        }

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
                role: 'system',
                content: metaAgent.instructions || ''
            },
            {
                type: 'message',
                role: 'user',
                content: `Analyze the recent agent activity and optimize performance. Recent history:\n\n${recentHistory}`
            }
        ];

        // Run metacognition request with AgentDefinition
        const metaAgentDef: AgentDefinition = {
            agent_id: metaAgent.agent_id,
            name: metaAgent.name,
            instructions: metaAgent.instructions,
            model: metaAgent.model,
            modelClass: metaAgent.modelClass,
            modelSettings: metaAgent.modelSettings,
            tools: metaAgent.tools
        };
        
        for await (const event of ensembleRequest(metaMessages, metaAgentDef)) {
            // Log metacognition responses
            if (event.type === 'message_delta' && 'content' in event) {
                console.log('[MECH:META]', event.content);
            }
        }

        console.log('[MECH] Metacognition process completed');
    } catch (error) {
        console.error('[MECH] Error in metacognition:', error);
        throw error;
    }
}