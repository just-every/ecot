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
import { setEnsembleLogger } from '@just-every/ensemble';
import { startDemoTask } from './task-core.js';

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
  
  let session = null;

  // Set this WebSocket as active for the logger
  logger.setActiveWebSocket(ws);

  session = startDemoTask(prompt, (data) => {
    ws.send(JSON.stringify(data));
  });

  ws.on('message', (message) => {
    try {
      const data = JSON.parse(message.toString());
      if (data.type === 'stop' && session) {
        session.abort();
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

    if (session) session.abort();

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