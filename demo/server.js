#!/usr/bin/env node
/**
 * Task Demo server with metamemory and metacognition visualization
 * 
 * This server demonstrates the Task framework with detailed visualization of:
 * - Metamemory thread management and processing
 * - Metacognition triggers and thoughts
 * - All LLM requests with full context
 * - Real-time state updates
 */

import dotenv from 'dotenv';
import { join } from 'path';
import express from 'express';
import { WebSocketServer } from 'ws';
import { createServer } from 'http';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { runTask } from '../dist/index.js';
import { Agent, ensembleRequest, createToolFunction, setEnsembleLogger } from '@just-every/ensemble';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Load .env from parent directory
dotenv.config({ path: join(__dirname, '..', '.env') });

// Debug: Log which API keys were loaded
console.log('🔐 Task Demo Environment:');
console.log('   OPENAI_API_KEY:', process.env.OPENAI_API_KEY ? '✅ Set' : '❌ Not set');
console.log('   ANTHROPIC_API_KEY:', process.env.ANTHROPIC_API_KEY ? '✅ Set' : '❌ Not set');
console.log('   GOOGLE_API_KEY:', process.env.GOOGLE_API_KEY ? '✅ Set' : '❌ Not set');
console.log('   XAI_API_KEY:', process.env.XAI_API_KEY ? '✅ Set' : '❌ Not set');

// Custom logger to track all LLM requests
class TaskDemoLogger {
  constructor() {
    this.activeWebSocket = null;
  }
  
  setActiveWebSocket(ws) {
    this.activeWebSocket = ws;
  }
  
  log_llm_request(agentId, providerName, model, requestData, timestamp) {
    const requestId = `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const time = timestamp || new Date();
    
    // Send to active WebSocket if available
    if (this.activeWebSocket) {
      this.activeWebSocket.send(JSON.stringify({
        type: 'llm_request',
        id: requestId,
        agentId,
        provider: providerName,
        model,
        timestamp: time.toISOString(),
        messages: requestData.messages || [],
        temperature: requestData.temperature,
        maxTokens: requestData.max_tokens
      }));
    }
    
    return requestId;
  }

  log_llm_response(requestId, responseData, timestamp) {
    if (!requestId || !this.activeWebSocket) return;
    
    const time = timestamp || new Date();
    
    this.activeWebSocket.send(JSON.stringify({
      type: 'llm_response',
      requestId,
      content: responseData.content?.[0]?.text || '',
      usage: responseData.usage ? {
        promptTokens: responseData.usage.input_tokens || 0,
        completionTokens: responseData.usage.output_tokens || 0,
        totalTokens: (responseData.usage.input_tokens || 0) + (responseData.usage.output_tokens || 0)
      } : null,
      duration: time.getTime() - Date.now() // This will be negative, but we'll fix it in the client
    }));
  }

  log_llm_error(requestId, errorData, timestamp) {
    if (!requestId || !this.activeWebSocket) return;
    
    this.activeWebSocket.send(JSON.stringify({
      type: 'llm_error',
      requestId,
      error: errorData,
      timestamp: timestamp?.toISOString() || new Date().toISOString()
    }));
  }
}

// Create and set the logger
const logger = new TaskDemoLogger();
setEnsembleLogger(logger);

// Generate mock response using mini model
async function generateMockResponse(toolName, args, context) {
  try {
    const mockAgent = new Agent({
      name: 'MockResponseGenerator',
      modelClass: 'mini',
      instructions: `You are generating realistic mock data for a tool called "${toolName}". 
                    Generate a brief, realistic response based on the provided arguments.
                    Keep responses concise but informative. Use realistic data formats.`
    });
    
    const prompt = `Generate a mock response for ${toolName} with arguments: ${JSON.stringify(args, null, 2)}
                   Context: ${context}
                   
                   Provide a realistic response that would be returned by this tool.`;
    
    const messages = [{
      type: 'message',
      role: 'user',
      content: prompt,
      id: `mock_${Date.now()}`
    }];
    
    let response = '';
    for await (const event of ensembleRequest(messages, mockAgent)) {
      if (event.type === 'message_delta' && event.content) {
        response += event.content;
      }
    }
    
    return response || `Mock result for ${toolName}`;
  } catch (error) {
    // Fallback to simple mock response
    return `Mock ${toolName} result: Successfully processed ${JSON.stringify(args)}`;
  }
}

// Create demo tools
function createDemoTools() {
  return [
    // Web/Research tools
    createToolFunction(
      async (query, options = {}) => {
        const results = options.max_results || 5;
        return await generateMockResponse('web_search', { query, results }, 
          'Web search tool that returns relevant search results with titles, URLs, and snippets');
      },
      'Search the web for information',
      {
        query: { type: 'string', description: 'Search query' },
        options: { 
          type: 'object',
          properties: {
            max_results: { type: 'number', description: 'Maximum number of results (default: 5)' }
          }
        }
      },
      undefined,
      'web_search'
    ),
    
    createToolFunction(
      async (url) => {
        return await generateMockResponse('fetch_page', { url }, 
          'Fetches and extracts content from a web page, returning the main text content');
      },
      'Fetch and extract content from a web page',
      {
        url: { type: 'string', description: 'URL to fetch' }
      },
      undefined,
      'fetch_page'
    ),
    
    // File/Code tools
    createToolFunction(
      async (path) => {
        return await generateMockResponse('read_file', { path }, 
          'Reads a file from the filesystem and returns its contents');
      },
      'Read a file from the filesystem',
      {
        path: { type: 'string', description: 'File path to read' }
      },
      undefined,
      'read_file'
    ),
    
    createToolFunction(
      async (code, language) => {
        return await generateMockResponse('analyze_code', { code, language }, 
          'Analyzes code for issues, patterns, complexity, and suggestions');
      },
      'Analyze code for quality, issues, and improvements',
      {
        code: { type: 'string', description: 'Code to analyze' },
        language: { type: 'string', description: 'Programming language' }
      },
      undefined,
      'analyze_code'
    ),
    
    // Travel/Planning tools
    createToolFunction(
      async (location, date) => {
        return await generateMockResponse('check_weather', { location, date }, 
          'Gets weather forecast for a location, including temperature, conditions, precipitation');
      },
      'Check weather forecast for a location',
      {
        location: { type: 'string', description: 'City or location name' },
        date: { type: 'string', description: 'Date (YYYY-MM-DD) or "today"' }
      },
      undefined,
      'check_weather'
    ),
    
    createToolFunction(
      async (from, to, date) => {
        return await generateMockResponse('search_flights', { from, to, date }, 
          'Searches for available flights between cities with prices and times');
      },
      'Search for flights between cities',
      {
        from: { type: 'string', description: 'Departure city' },
        to: { type: 'string', description: 'Arrival city' },
        date: { type: 'string', description: 'Travel date (YYYY-MM-DD)' }
      },
      undefined,
      'search_flights'
    ),
    
    createToolFunction(
      async (city, checkin, checkout) => {
        return await generateMockResponse('search_hotels', { city, checkin, checkout }, 
          'Searches for available hotels with ratings, prices, and amenities');
      },
      'Search for hotels in a city',
      {
        city: { type: 'string', description: 'City name' },
        checkin: { type: 'string', description: 'Check-in date (YYYY-MM-DD)' },
        checkout: { type: 'string', description: 'Check-out date (YYYY-MM-DD)' }
      },
      undefined,
      'search_hotels'
    ),
    
    // Math/Calculation tools
    createToolFunction(
      async (expression) => {
        try {
          // For simple expressions, actually calculate
          const result = eval(expression.replace(/[^0-9+\-*/().\s]/g, ''));
          return `Result: ${result}`;
        } catch {
          return await generateMockResponse('calculate', { expression }, 
            'Evaluates mathematical expressions and returns the result');
        }
      },
      'Calculate mathematical expressions',
      {
        expression: { type: 'string', description: 'Mathematical expression to evaluate' }
      },
      undefined,
      'calculate'
    )
  ];
}

const app = express();
const server = createServer(app);
const PORT = process.env.TASK_DEMO_PORT || 3020;

// Serve static files
app.use(express.static(__dirname));

// Serve the dist directory for modules
app.use('/dist', express.static(join(__dirname, '..', 'dist')));

// WebSocket server for real-time updates
const wss = new WebSocketServer({ server });

// Handle WebSocket connections with prompt in URL
wss.on('connection', (ws, req) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const prompt = url.searchParams.get('prompt');
  
  if (!prompt) {
    ws.send(JSON.stringify({ type: 'error', message: 'No prompt provided' }));
    ws.close();
    return;
  }

  const sessionId = Math.random().toString(36).substr(2, 9);
  console.log(`🔗 New Task demo connection: ${sessionId}`);
  
  let taskGenerator = null;
  const threads = new Map();
  const metamemoryThreads = new Map();
  let messageCount = 0;
  let thinkingCount = 0;
  let toolCallCount = 0;

  // Set this WebSocket as active for the logger
  logger.setActiveWebSocket(ws);

  const runTaskWithWebSocket = async () => {
    try {
      ws.send(JSON.stringify({ type: 'status', status: 'running' }));

      // Create agent configuration with demo tools
      const demoTools = createDemoTools();
      const agent = new Agent({
        name: 'TaskDemoAgent',
        modelClass: 'standard',
        instructions: `You are a helpful AI assistant demonstrating the Task framework. You have access to various tools for web search, file operations, data analysis, planning, and more. Use these tools as needed to complete the task thoroughly. Be detailed in your work and use multiple tools when appropriate. When you have fully completed the task, use the task_complete tool with a comprehensive summary.`,
        tools: demoTools
      });

      // Track main thread
      const mainThreadId = 'main-thread';
      threads.set(mainThreadId, {
        id: mainThreadId,
        name: 'Main Conversation',
        type: 'main',
        messages: []
      });

      // Send initial thread info
      ws.send(JSON.stringify({
        type: 'thread',
        id: mainThreadId,
        name: 'Main Conversation',
        threadType: 'main',
        messages: []
      }));

      // Add user message
      messageCount++;
      const userMessage = {
        type: 'message',
        id: `msg-${messageCount}`,
        role: 'user',
        content: prompt,
        threadId: mainThreadId,
        timestamp: Date.now()
      };
      
      threads.get(mainThreadId).messages.push(userMessage.id);
      ws.send(JSON.stringify(userMessage));

      let lastMessageRole = null;
      let lastMessageContent = [];
      let currentToolCall = null;
      let messageStartTime = Date.now();

      // Run the task with real AI
      taskGenerator = runTask(agent, prompt, {
        metamemoryEnabled: true,
        processInterval: 2,
        windowSize: 10,
        metaFrequency: 10
      });

      for await (const event of taskGenerator) {
        // Handle different event types from ensemble
        switch (event.type) {
          case 'agent_start':
            console.log('Agent started:', event.agent?.name);
            break;

          case 'message_start':
            lastMessageRole = event.message?.role || 'assistant';
            lastMessageContent = [];
            messageStartTime = Date.now();
            break;

          case 'message_delta':
            if (event.content) {
              lastMessageContent.push(event.content);
            }
            break;

          case 'message_done':
            const fullContent = lastMessageContent.join('');
            if (fullContent) {
              messageCount++;
              const messageId = `msg-${messageCount}`;
              
              // Add to thread
              threads.get(mainThreadId).messages.push(messageId);
              
              const message = {
                type: 'message',
                id: messageId,
                role: lastMessageRole,
                content: fullContent,
                threadId: mainThreadId,
                timestamp: Date.now()
              };
              
              ws.send(JSON.stringify(message));
            }
            break;

          case 'thinking':
            if (event.content) {
              thinkingCount++;
              ws.send(JSON.stringify({
                type: 'thinking',
                content: event.content,
                threadId: mainThreadId,
                thinkingType: 'reasoning'
              }));
            }
            break;

          case 'tool_start':
            if (event.tool_call) {
              currentToolCall = {
                id: event.tool_call.id || `tool-${++toolCallCount}`,
                name: event.tool_call.function?.name,
                arguments: event.tool_call.function?.arguments
              };
              
              ws.send(JSON.stringify({
                type: 'tool_call',
                ...currentToolCall,
                threadId: mainThreadId
              }));
            }
            break;

          case 'tool_done':
            if (currentToolCall && event.result) {
              ws.send(JSON.stringify({
                type: 'tool_result',
                toolId: currentToolCall.id,
                result: event.result.output,
                duration: Date.now() - messageStartTime
              }));
            }
            
            // Check if task is complete
            if (event.tool_call?.function?.name === 'task_complete') {
              ws.send(JSON.stringify({ 
                type: 'status', 
                status: 'completed',
                result: event.result?.output
              }));
            } else if (event.tool_call?.function?.name === 'task_fatal_error') {
              ws.send(JSON.stringify({ 
                type: 'error', 
                message: event.result?.output 
              }));
              ws.send(JSON.stringify({ 
                type: 'status', 
                status: 'error' 
              }));
            }
            break;

          case 'metamemory_processing':
            if (event.data) {
              const threadId = `metamemory-${event.data.threadClass || 'unknown'}`;
              if (!metamemoryThreads.has(threadId)) {
                metamemoryThreads.set(threadId, {
                  id: threadId,
                  name: event.data.threadClass || 'Metamemory',
                  size: 0,
                  overlap: new Set(),
                  messages: []
                });
              }
              
              const thread = metamemoryThreads.get(threadId);
              thread.size++;
              
              ws.send(JSON.stringify({
                type: 'thread',
                id: threadId,
                name: thread.name,
                threadType: 'metamemory',
                metadata: {
                  triggerReason: event.data.trigger
                }
              }));
            }
            break;

          case 'metacognition_trigger':
            if (event.data) {
              ws.send(JSON.stringify({
                type: 'thinking',
                content: event.data.reasoning,
                threadId: 'metacognition',
                thinkingType: 'reflection'
              }));
              
              ws.send(JSON.stringify({
                type: 'thread',
                id: 'metacognition',
                name: 'Metacognition',
                threadType: 'metacognition',
                metadata: {
                  triggerReason: event.data.trigger
                }
              }));
            }
            break;

          // LLM requests are now handled by the EnsembleLogger

          case 'error':
            ws.send(JSON.stringify({
              type: 'error',
              message: event.error || 'Unknown error'
            }));
            break;
        }
      }

      // Send final analysis
      const metaAnalysis = {
        threads: Array.from(metamemoryThreads.values()),
        metacognition: [],
        summary: {
          totalThreads: threads.size + metamemoryThreads.size,
          totalMessages: messageCount,
          avgOverlap: metamemoryThreads.size > 0 ? 0.2 : 0,
          mostActiveThread: 'Main Conversation'
        }
      };

      ws.send(JSON.stringify({
        type: 'meta_analysis',
        analysis: metaAnalysis
      }));

      // Mark as completed if not already done
      ws.send(JSON.stringify({ 
        type: 'status', 
        status: 'completed' 
      }));

    } catch (error) {
      console.error('Task error:', error);
      ws.send(JSON.stringify({ 
        type: 'error', 
        message: error.message 
      }));
      ws.send(JSON.stringify({ 
        type: 'status', 
        status: 'error' 
      }));
    }
  };

  runTaskWithWebSocket();

  ws.on('message', (message) => {
    try {
      const data = JSON.parse(message.toString());
      if (data.type === 'stop' && taskGenerator) {
        // Signal to stop the task
        ws.send(JSON.stringify({ 
          type: 'status', 
          status: 'stopped' 
        }));
        ws.close();
      }
    } catch (error) {
      console.error('Message parse error:', error);
    }
  });

  ws.on('close', () => {
    // Cleanup if needed
    console.log(`🔌 Task demo connection closed: ${sessionId}`);
    
    // Clear the active WebSocket from logger
    logger.setActiveWebSocket(null);
  });
});

// Start the server
server.listen(PORT, () => {
  console.log(`🚀 Task Demo Server running on http://localhost:${PORT}`);
  console.log(`📊 WebSocket endpoint: ws://localhost:${PORT}/ws`);
  console.log('');
  console.log('🧠 Features available:');
  console.log('   • Real-time metamemory thread visualization');
  console.log('   • Metacognition trigger tracking');
  console.log('   • Detailed LLM request monitoring');
  console.log('   • Live conversation streaming');
  console.log('   • Configurable metamemory and metacognition settings');
  console.log('');
  console.log('💡 Configure API keys in .env file for full functionality');
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\n🔄 Shutting down Task Demo Server...');
  
  // Close WebSocket server
  wss.close(() => {
    console.log('✅ WebSocket server closed');
  });
  
  // Close HTTP server
  server.close(() => {
    console.log('✅ Task Demo Server stopped');
    process.exit(0);
  });
  
  // Force exit after 5 seconds if graceful shutdown fails
  setTimeout(() => {
    console.log('⚠️  Forcing shutdown after timeout');
    process.exit(0);
  }, 5000);
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  console.error('⚠️  Unhandled Rejection at:', promise, 'reason:', reason);
});