/**
 * metacognition module for MECH
 *
 * This module implements "thinking about thinking" capabilities for the MECH system.
 * It spawns an LLM agent that analyzes recent thought history and can adjust system
 * parameters to improve performance.
 */

import type { Agent, MechContext } from '../state/types.js';
import {
    mechState,
    getMetaCognitionTools,
    listDisabledModels,
    listModelScores,
} from '../state/state.js';
import { getThoughtDelay, getThoughtTools } from './thought_utils.js';
import { ResponseInput, getModelFromClass, Agent as EnsembleAgent } from '@just-every/ensemble';

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
 * @param context - MECH execution context with history and tools
 * @param startTime - When the current task execution began (for performance analysis)
 * 
 * @throws {TypeError} If any required parameters are invalid
 * 
 * @example
 * ```typescript
 * // Triggered automatically based on meta frequency
 * await spawnMetaThought(agent, context, taskStartTime);
 * 
 * // Metacognition might result in:
 * // - Model score adjustments
 * // - Injected strategic thoughts
 * // - Changed meta frequency
 * // - Disabled underperforming models
 * ```
 */
export async function spawnMetaThought(
    agent: Agent, 
    context: MechContext,
    startTime: Date
): Promise<void> {
    // Validate inputs
    if (!agent || typeof agent !== 'object') {
        throw new TypeError('[MECH] Invalid agent for metacognition');
    }
    
    if (!context || typeof context !== 'object') {
        throw new TypeError('[MECH] Invalid context for metacognition');
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

---
${context.MAGI_CONTEXT || ''}
---

## Your Metacognition Role
1.  **Role Focus:** You are **strictly** an observer and tuner. **DO NOT** perform the agent's primary task. Focus solely on the *quality*, *efficiency*, and *robustness* of ${agent.name}'s operation.
2.  **Evidence-Based:** Base all diagnoses and proposed changes on concrete evidence found in the provided in the recent history.
3.  **Incremental Change:** Propose adjustments only when clearly warranted. Favor specific, targeted changes over broad ones.

## Reason step-by-step (Internal Monologue)
1. Carefully examine recent thoughts and tool use.
2. Look for recurring sequences, errors, inefficiencies, or successes.
- Are thoughts logical, coherent and relevant?
- Have there been any incorrect assumptions or decisions?
- Any loops or hallucinations?
- Are tools used effectively?
- Are errors frequent or avoidable?
3. Choose the primary issue or success observed (e.g., "Inefficient: Agent repeatedly tried failed API call X," "Effective: Reasoning path consistently leads to correct solution quickly," "Failing: Hallucinating incorrect file paths").
4. Based on the diagnosis, determine which tools to use. Consider:
- injectThought: Guide the agent away from pitfalls or towards better strategies?
- setThoughtDelay: If the agent is looping with nothing to do, slowing down will give it's tasks or tools more time to complete. Alternatively if there's a lot of work to do, speeding up will help the agent work on the problem faster.
- setMetaFrequency: How often do you need to monitor the agent and "think about thinking"? Do this more often if things are not going well.
- setModelScore: Adjust the scores of models based on their recent performance. The scores set the probability of using a model in the next round. A higher score means more likely to be used.
- disableModel: Disable a model based on performance? If a model is not well suited to a task, it may be better to disable it.
5. Self-critique: Does this change directly address the diagnosed issue? Is it justified by the evidence? What are potential side effects? Is there a simpler alternative? (Meta-CoT: Think, Check, Act).

## Final Tool Use
- Use the most appropriate tools to implement the changes.
- You only run once each time. Output all the tools required for your changes in parallel in your current output.
- You will see the results next time you run after the Meta Frequency.
`,
            tools: [...getMetaCognitionTools(context), ...getThoughtTools(context)],
            modelClass: 'metacognition' as any,
            historyThread: []
        });

        // Use a high-quality reasoning model
        try {
            metaAgent.model = await getModelFromClass('metacognition');
        } catch (modelError) {
            console.error('[MECH] Failed to get metacognition model:', modelError);
            // Fall back to a default model if metacognition model fails
            try {
                metaAgent.model = await getModelFromClass('reasoning');
            } catch (fallbackError) {
                console.error('[MECH] Failed to get fallback model:', fallbackError);
                throw new Error('No model available for metacognition');
            }
        }

        let messages: ResponseInput = [];

        const currentTime = context.dateFormat ? context.dateFormat() : new Date().toISOString();
        const runningTime = context.readableTime 
            ? context.readableTime(new Date().getTime() - startTime.getTime())
            : `${Math.round((new Date().getTime() - startTime.getTime()) / 1000)}s`;
            
        // Handle async project listing separately to avoid template literal issues
        const projectsInfo = context.listActiveProjects 
            ? await context.listActiveProjects().catch(() => 'Error loading projects')
            : 'N/A';
            
        const activeToolsInfo = context.runningToolTracker 
            ? context.runningToolTracker.listActive() 
            : 'N/A';
        
        messages.push({
            type: 'message',
            role: 'developer',
            content: `=== ${agent.name} Status ===

Current Time: ${currentTime}
${agent.name} Running Time: ${runningTime}
${agent.name} Thought Delay: ${getThoughtDelay()} seconds [delay between ${agent.name} LLM requests - change with setThoughtDelay(delay)]

${agent.name} Projects:
${projectsInfo}

${agent.name} Active Tools:
${activeToolsInfo}


=== Metacognition Status ===

Meta Frequency: ${mechState.metaFrequency} [LLM requests between Metacognition runs - change with setMetaFrequency(frequency)]

Disabled Models:
${listDisabledModels()}
[change with disableModel(modelId)]

Model Scores:
${listModelScores(agent.modelClass as any)}
[change with setModelScore(modelId, score)]`,
        });

        // Add the status message we just created to history first
        context.addHistory(messages[0]);

        const showCount = 10 + parseInt(mechState.metaFrequency) * 3;
        messages = context.describeHistory(agent, messages, showCount);

        // Add any additional messages from describeHistory
        for (let i = 1; i < messages.length; i++) {
            context.addHistory(messages[i]);
        }

        // Run the metacognition agent
        console.log('[MECH] Running metacognition agent with tools');
        
        // Import and run the core MECH function
        const { runMECHCore } = await import('./engine.js');
        await runMECHCore(`Analyze and optimize ${agent.name}'s performance`, metaAgent, context);
        
    } catch (error) {
        console.error('[MECH] Error in metacognition process:', error);
        // Re-throw critical errors
        if (error instanceof TypeError || 
            (error instanceof Error && error.message.includes('No model available'))) {
            throw error;
        }
        // Log and continue for other errors
    }
}