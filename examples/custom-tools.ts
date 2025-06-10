/**
 * Custom Tools Example
 * 
 * This example demonstrates how to add custom tools to a Task agent.
 * Shows how to create tools using @just-every/ensemble's tool system.
 */

import { runTask } from '../index.js';
import { Agent, createToolFunction } from '@just-every/ensemble';

async function main() {
    console.log('🔧 Task Custom Tools Example\n');
    
    // Create custom tools
    const calculateTool = createToolFunction(
        (args: { expression: string }) => {
            try {
                // Simple calculator (eval is dangerous in production, this is just for demo)
                const result = eval(args.expression);
                return `The result of ${args.expression} is ${result}`;
            } catch (error) {
                return `Error calculating ${args.expression}: ${error}`;
            }
        },
        'Calculate mathematical expressions',
        {
            expression: {
                type: 'string',
                description: 'Mathematical expression to evaluate (e.g., "2 + 2", "Math.sqrt(16)")'
            }
        },
        undefined,
        'calculate'
    );
    
    const weatherTool = createToolFunction(
        (args: { city: string }) => {
            // Mock weather data (in production, call a real weather API)
            const mockWeather = {
                'New York': 'Sunny, 22°C',
                'London': 'Cloudy, 15°C',
                'Tokyo': 'Rainy, 18°C',
                'Sydney': 'Partly cloudy, 25°C'
            };
            
            const weather = mockWeather[args.city as keyof typeof mockWeather] || 'Weather data not available';
            return `Weather in ${args.city}: ${weather}`;
        },
        'Get weather information for a city',
        {
            city: {
                type: 'string',
                description: 'Name of the city to get weather for'
            }
        },
        undefined,
        'get_weather'
    );
    
    // Create agent with custom tools
    const agent = new Agent({
        name: 'ToolBot',
        instructions: 'You are a helpful assistant with access to calculation and weather tools. Use these tools when needed to provide accurate information.',
        modelClass: 'reasoning',
        tools: [calculateTool, weatherTool]
    });
    
    const task = 'I need to plan a trip. Can you calculate how much 3 nights at $150 per night would cost, and also tell me the weather in Tokyo?';
    
    try {
        console.log('Starting Task with custom tools...\n');
        
        for await (const event of runTask(agent, task)) {
            // Show message content
            if (event.type === 'message_delta' && 'content' in event) {
                process.stdout.write(event.content);
            }
            
            // Show tool calls
            if (event.type === 'tool_start' && 'tool_call' in event) {
                const toolEvent = event as any;
                console.log(`\n🔧 Calling tool: ${toolEvent.tool_call?.function?.name}`);
                console.log(`   Arguments: ${JSON.stringify(toolEvent.tool_call?.function?.arguments)}`);
            }
            
            if (event.type === 'tool_done' && 'result' in event) {
                const toolEvent = event as any;
                const toolName = toolEvent.tool_call?.function?.name;
                
                if (toolName === 'task_complete') {
                    console.log('\n\n✅ Task completed!');
                    console.log(`Result: ${toolEvent.result?.output}`);
                    break;
                } else {
                    console.log(`   Result: ${toolEvent.result?.output}\n`);
                }
            }
        }
        
    } catch (error) {
        console.error('❌ Error:', error);
    }
}

if (import.meta.url === `file://${process.argv[1]}`) {
    main().catch(console.error);
}