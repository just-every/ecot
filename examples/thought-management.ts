/**
 * Thought Management Example
 * 
 * This example shows how MECH manages thought delays and
 * interruptions for better reasoning flow.
 * 
 * MECH now handles all LLM communication internally through @just-every/ensemble,
 * providing automatic thought pacing and intelligent delays.
 */

import { runMECH } from '../simple.js';
import { setThoughtDelay, getThoughtDelay, setDelayInterrupted } from '../thought_utils.js';
import type { RunMechOptions } from '../types.js';

async function simulateThoughtProcess() {
    console.log('💭 Thought Management Example\n');
    console.log('Note: This example requires API keys to be configured in your environment.\n');
    
    // Track thought timing
    const thoughtTimings: { thought: string; duration: number }[] = [];
    let lastThoughtTime = Date.now();
    
    try {
        // Test different thought delays
        const delays = ['0', '2', '4'] as const;
        
        console.log('ℹ️  MECH Thought Management Features:');
        console.log('   • Configurable delays between thoughts (0-128 seconds)');
        console.log('   • Interruptible thought processes');
        console.log('   • Automatic pacing for complex reasoning');
        console.log('   • Real-time thought status updates\n');
        
        for (const delay of delays) {
            console.log(`\n${'='.repeat(60)}`);
            console.log(`Testing with thought delay: ${delay} seconds`);
            console.log('='.repeat(60));
            
            setThoughtDelay(delay);
            
            const startTime = Date.now();
            
            const options: RunMechOptions = {
                agent: {
                    name: 'ThoughtfulBot',
                    modelClass: 'reasoning',
                    instructions: 'You think carefully before responding. Take your time to consider the question.'
                },
                task: `Quick question with ${delay}s delay: What is 2+2?`,
                onStatus: (status) => {
                    if (status.type === 'thought_delay') {
                        console.log(`\n⏱️  Thought delay: ${(status as any).delayMs}ms`);
                    } else if (status.type === 'thought_complete') {
                        const duration = Date.now() - lastThoughtTime;
                        console.log(`   ✓ Thought completed in ${duration}ms`);
                        lastThoughtTime = Date.now();
                    }
                },
                onHistory: (item) => {
                    if (item.type === 'thinking' && 'content' in item) {
                        const duration = Date.now() - lastThoughtTime;
                        const thought = String(item.content).substring(0, 50);
                        thoughtTimings.push({ thought, duration });
                        console.log(`\n💭 Thinking: "${thought}..."`);
                    }
                }
            };
            
            const result = await runMECH(options);
            
            const totalTime = Date.now() - startTime;
            console.log(`\n✅ Completed in ${(totalTime / 1000).toFixed(1)}s`);
            console.log(`   Status: ${result.status}`);
        }
        
        // Test thought interruption
        console.log(`\n\n${'='.repeat(60)}`);
        console.log('Testing thought interruption');
        console.log('='.repeat(60));
        
        setThoughtDelay('8'); // Set a long delay
        console.log('\nSetting thought delay to 8 seconds...');
        console.log('Will interrupt after 2 seconds to demonstrate interruption handling.');
        
        const interruptOptions: RunMechOptions = {
            agent: {
                name: 'ThoughtfulBot',
                modelClass: 'reasoning',
                instructions: 'You are analyzing a complex problem that requires deep thought.'
            },
            task: 'Analyze the philosophical implications of artificial general intelligence on human society, considering ethical, economic, and existential perspectives.',
            onStatus: (status) => {
                if (status.type === 'thought_delay') {
                    console.log(`\n⏱️  Starting ${(status as any).delayMs}ms thought delay...`);
                }
            },
            onHistory: (item) => {
                if (item.type === 'thinking') {
                    console.log('💭 Deep thinking in progress...');
                }
            }
        };
        
        // Start a task
        const interruptPromise = runMECH(interruptOptions);
        
        // Interrupt after 2 seconds
        setTimeout(() => {
            console.log('\n⚡ INTERRUPTING THOUGHT PROCESS!');
            setDelayInterrupted(true);
        }, 2000);
        
        const interruptResult = await interruptPromise;
        console.log(`\n✅ Interrupted task status: ${interruptResult.status}`);
        
        // Summary
        console.log('\n\n📊 Thought Timing Summary:');
        console.log('-'.repeat(50));
        
        if (thoughtTimings.length > 0) {
            const avgDuration = thoughtTimings.reduce((sum, t) => sum + t.duration, 0) / thoughtTimings.length;
            console.log(`Total thoughts: ${thoughtTimings.length}`);
            console.log(`Average duration: ${(avgDuration / 1000).toFixed(1)}s`);
            
            console.log('\nIndividual thoughts:');
            thoughtTimings.forEach((t, i) => {
                console.log(`  ${i + 1}. "${t.thought}..." (${(t.duration / 1000).toFixed(1)}s)`);
            });
        }
        
        console.log('\n💡 Key Takeaways:');
        console.log('   • Thought delays improve reasoning quality');
        console.log('   • Longer delays allow for deeper analysis');
        console.log('   • Interruption handling prevents blocking');
        console.log('   • Configurable delays adapt to task complexity');
        
    } catch (error) {
        console.error('❌ Error:', error);
        console.log('\n🔧 Common issues:');
        console.log('   • Ensure API keys are set in your environment');
        console.log('   • Check that @just-every/ensemble is properly installed');
    }
}

async function main() {
    await simulateThoughtProcess();
}

if (import.meta.url === `file://${process.argv[1]}`) {
    main().catch(console.error);
}