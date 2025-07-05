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
import { Agent, EnsembleLogger, setEnsembleLogger, ensembleRequest, createToolFunction, type ToolFunction } from '@just-every/ensemble';
import { runTask, type InitialTaskState, type TaskEvent } from '../index.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Load .env from root directory
dotenv.config({ path: join(__dirname, '..', '.env') });

// Debug: Log which API keys were loaded
console.log('🔐 Task Demo Environment:');
console.log('   OPENAI_API_KEY:', process.env.OPENAI_API_KEY ? '✅ Set' : '❌ Not set');
console.log('   ANTHROPIC_API_KEY:', process.env.ANTHROPIC_API_KEY ? '✅ Set' : '❌ Not set');
console.log('   GOOGLE_API_KEY:', process.env.GOOGLE_API_KEY ? '✅ Set' : '❌ Not set');
console.log('   XAI_API_KEY:', process.env.XAI_API_KEY ? '✅ Set' : '❌ Not set');

const app = express();
const server = createServer(app);
const PORT = process.env.TASK_DEMO_PORT || 3020;

// Serve static files
app.use(express.static(__dirname));

// Serve the dist directory for modules
app.use('/dist', express.static(join(__dirname, '..', 'dist')));

// WebSocket server for real-time updates
const wss = new WebSocketServer({ server });

interface TaskSession {
    id: string;
    ws: any;
    agent?: Agent;
    taskGenerator?: AsyncGenerator<any>;
    abortController?: AbortController;
    config?: any;
    metrics: {
        messageCount: number;
        requestCount: number;
        metamemoryTriggers: number;
        metacognitionTriggers: number;
    };
    llmRequests: any[];
    startTime: number;
}

const activeSessions = new Map<string, TaskSession>();

// Store all LLM requests and responses
interface LLMRequestData {
    id: string;
    agentId: string;
    provider: string;
    model: string;
    timestamp: Date;
    request: unknown;
    response?: unknown;
    error?: unknown;
    status: 'pending' | 'complete' | 'error';
    duration?: number;
}

const llmRequests = new Map<string, LLMRequestData>();

// Custom logger to track all LLM requests
class TaskDemoLogger implements EnsembleLogger {
    private activeSession: TaskSession | null = null;
    
    setActiveSession(session: TaskSession | null) {
        this.activeSession = session;
    }
    
    log_llm_request(
        agentId: string,
        providerName: string,
        model: string,
        requestData: unknown,
        timestamp?: Date
    ): string {
        const requestId = `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        const time = timestamp || new Date();
        
        const llmRequest: LLMRequestData = {
            id: requestId,
            agentId,
            provider: providerName,
            model,
            timestamp: time,
            request: requestData,
            status: 'pending'
        };
        
        llmRequests.set(requestId, llmRequest);
        
        // Send to active session if available
        if (this.activeSession && this.activeSession.ws) {
            this.activeSession.ws.send(JSON.stringify({
                type: 'llm_request_detailed',
                requestId,
                agentId,
                provider: providerName,
                model,
                timestamp: time.toISOString(),
                request: requestData,
                status: 'pending'
            }));
        }
        
        return requestId;
    }

    log_llm_response(
        requestId: string | undefined,
        responseData: unknown,
        timestamp?: Date
    ): void {
        if (!requestId) return;
        
        const request = llmRequests.get(requestId);
        if (request) {
            request.response = responseData;
            request.status = 'complete';
            request.duration = (timestamp || new Date()).getTime() - request.timestamp.getTime();
            
            // Send update to active session
            if (this.activeSession && this.activeSession.ws) {
                this.activeSession.ws.send(JSON.stringify({
                    type: 'llm_response_detailed',
                    requestId,
                    response: responseData,
                    duration: request.duration,
                    status: 'complete'
                }));
            }
        }
    }

    log_llm_error(
        requestId: string | undefined,
        errorData: unknown,
        timestamp?: Date
    ): void {
        if (!requestId) return;
        
        const request = llmRequests.get(requestId);
        if (request) {
            request.error = errorData;
            request.status = 'error';
            request.duration = (timestamp || new Date()).getTime() - request.timestamp.getTime();
            
            // Send error to active session
            if (this.activeSession && this.activeSession.ws) {
                this.activeSession.ws.send(JSON.stringify({
                    type: 'llm_error_detailed',
                    requestId,
                    error: errorData,
                    duration: request.duration,
                    status: 'error'
                }));
            }
        }
    }
}

// Create and set the logger
const logger = new TaskDemoLogger();
setEnsembleLogger(logger);

// Generate mock response using mini model
async function generateMockResponse(toolName: string, args: any, context: string): Promise<string> {
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
            type: 'message' as const,
            role: 'user' as const,
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
function createDemoTools(): ToolFunction[] {
    return [
        // Web/Research tools
        createToolFunction(
            async (query: string, options?: { max_results?: number }) => {
                const results = options?.max_results || 5;
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
            async (url: string) => {
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
            async (path: string) => {
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
            async (code: string, language: string) => {
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
        
        createToolFunction(
            async (path: string, content: string) => {
                return await generateMockResponse('write_file', { path, content }, 
                    'Writes content to a file, creating directories if needed');
            },
            'Write content to a file',
            {
                path: { type: 'string', description: 'File path to write' },
                content: { type: 'string', description: 'Content to write' }
            },
            undefined,
            'write_file'
        ),
        
        createToolFunction(
            async (directory: string = '.') => {
                return await generateMockResponse('list_files', { directory }, 
                    'Lists files and directories in the specified path');
            },
            'List files in a directory',
            {
                directory: { type: 'string', description: 'Directory path (default: current)' }
            },
            undefined,
            'list_files'
        ),
        
        // Data analysis tools
        createToolFunction(
            async (data: any[], analysis_type: string) => {
                return await generateMockResponse('analyze_data', { data, analysis_type }, 
                    'Performs statistical analysis on data: mean, median, correlation, trends');
            },
            'Analyze data and provide insights',
            {
                data: { type: 'array', description: 'Data to analyze' },
                analysis_type: { type: 'string', description: 'Type of analysis: statistics, trends, correlation' }
            },
            undefined,
            'analyze_data'
        ),
        
        createToolFunction(
            async (data: any[], chart_type: string, title: string) => {
                return await generateMockResponse('create_chart', { data, chart_type, title }, 
                    'Creates a chart visualization and returns a description or ASCII representation');
            },
            'Create a data visualization chart',
            {
                data: { type: 'array', description: 'Data to visualize' },
                chart_type: { type: 'string', description: 'Chart type: bar, line, pie, scatter' },
                title: { type: 'string', description: 'Chart title' }
            },
            undefined,
            'create_chart'
        ),
        
        // Planning/Travel tools
        createToolFunction(
            async (location: string, date?: string) => {
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
            async (from: string, to: string, date: string) => {
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
            async (city: string, checkin: string, checkout: string) => {
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
        
        // Database/API tools
        createToolFunction(
            async (query: string, database: string = 'main') => {
                return await generateMockResponse('query_database', { query, database }, 
                    'Executes a database query and returns results in tabular format');
            },
            'Execute a database query',
            {
                query: { type: 'string', description: 'SQL query to execute' },
                database: { type: 'string', description: 'Database name (default: main)' }
            },
            undefined,
            'query_database'
        ),
        
        createToolFunction(
            async (endpoint: string, method: string = 'GET', data?: any) => {
                return await generateMockResponse('call_api', { endpoint, method, data }, 
                    'Makes an API call and returns the JSON response');
            },
            'Make an API call',
            {
                endpoint: { type: 'string', description: 'API endpoint URL' },
                method: { type: 'string', description: 'HTTP method (GET, POST, PUT, DELETE)' },
                data: { type: 'string', description: 'Request body data' }
            },
            undefined,
            'call_api'
        ),
        
        // Communication tools
        createToolFunction(
            async (text: string, target_language: string) => {
                return await generateMockResponse('translate_text', { text, target_language }, 
                    'Translates text to the target language accurately');
            },
            'Translate text to another language',
            {
                text: { type: 'string', description: 'Text to translate' },
                target_language: { type: 'string', description: 'Target language code (e.g., es, fr, de)' }
            },
            undefined,
            'translate_text'
        ),
        
        createToolFunction(
            async (to: string, subject: string, context: string) => {
                return await generateMockResponse('draft_email', { to, subject, context }, 
                    'Drafts a professional email based on the context provided');
            },
            'Draft an email message',
            {
                to: { type: 'string', description: 'Recipient email' },
                subject: { type: 'string', description: 'Email subject' },
                context: { type: 'string', description: 'Context and key points for the email' }
            },
            undefined,
            'draft_email'
        ),
        
        // Math/Calculation tools
        createToolFunction(
            async (expression: string) => {
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

// Enhanced event tracking for metamemory and metacognition
class TaskEventTracker {
    private session: TaskSession;
    private originalConsoleLog: typeof console.log;
    private originalConsoleError: typeof console.error;

    constructor(session: TaskSession) {
        this.session = session;
        this.originalConsoleLog = console.log;
        this.originalConsoleError = console.error;
        this.interceptConsoleOutput();
    }

    private interceptConsoleOutput() {
        // Intercept console.log to catch metamemory and metacognition logs
        console.log = (...args: any[]) => {
            const message = args.join(' ');
            
            // Detect metamemory events
            if (message.includes('[Metamemory]')) {
                this.handleMetamemoryLog(message, args);
            }
            
            // Detect live state updates
            if (message.includes('[Metamemory] LIVE_STATE_UPDATE:')) {
                this.handleLiveStateUpdate(message, args);
            }
            
            // Detect metacognition events
            if (message.includes('[Task] Triggering meta-cognition') || message.includes('Meta-thought')) {
                this.handleMetacognitionLog(message, args);
            }
            
            // Skip LLM request detection from console logs - we use EnsembleLogger instead
            
            // Call original console.log
            this.originalConsoleLog(...args);
        };

        console.error = (...args: any[]) => {
            const message = args.join(' ');
            
            // Send errors to client
            this.sendToClient({
                type: 'error',
                error: message,
                timestamp: Date.now()
            });
            
            // Call original console.error
            this.originalConsoleError(...args);
        };
    }

    private handleMetamemoryLog(message: string, _args: any[]) {
        this.session.metrics.metamemoryTriggers++;
        
        let eventData: any = {
            type: 'metamemory_update',
            message: message,
            timestamp: Date.now()
        };

        // Parse specific metamemory events
        if (message.includes('Analysis Request')) {
            eventData.trigger = { type: 'llm_analysis_request' };
        } else if (message.includes('Processing Complete')) {
            eventData.trigger = { type: 'processing_complete' };
        } else if (message.includes('background processing completed')) {
            eventData.trigger = { type: 'background_complete' };
        } else if (message.includes('Parsed Result')) {
            // Send the full parsing details for thread visualization
            eventData.trigger = { type: 'thread_assignments' };
            eventData.details = message;
        }

        this.sendToClient(eventData);
    }

    private handleLiveStateUpdate(message: string, _args: any[]) {
        try {
            // Extract JSON from the log message
            const jsonStart = message.indexOf('{');
            if (jsonStart !== -1) {
                const jsonString = message.substring(jsonStart);
                const stateData = JSON.parse(jsonString);
                
                // Send the live state update
                this.sendToClient({
                    type: 'metamemory_live_update',
                    state: stateData,
                    timestamp: Date.now()
                });
            }
        } catch (error) {
            console.error('Error parsing live state update:', error);
        }
    }

    private handleMetacognitionLog(message: string, _args: any[]) {
        this.session.metrics.metacognitionTriggers++;
        
        this.sendToClient({
            type: 'metacognition_trigger',
            content: message,
            timestamp: Date.now()
        });
    }

    private handleLLMRequestLog(message: string, _args: any[]) {
        // Skip this - we're using the EnsembleLogger for proper LLM tracking
        // This was capturing console logs which is not what we want
    }

    private sendToClient(data: any) {
        if (this.session.ws && this.session.ws.readyState === 1) {
            try {
                this.session.ws.send(JSON.stringify(data));
            } catch (error) {
                console.error('Failed to send to client:', error);
            }
        }
    }

    cleanup() {
        // Restore original console methods
        console.log = this.originalConsoleLog;
        console.error = this.originalConsoleError;
    }
}

wss.on('connection', (ws: any) => {
    const sessionId = Math.random().toString(36).substr(2, 9);
    console.log(`🔗 New Task demo connection: ${sessionId}`);
    
    const session: TaskSession = {
        id: sessionId,
        ws: ws,
        metrics: {
            messageCount: 0,
            requestCount: 0,
            metamemoryTriggers: 0,
            metacognitionTriggers: 0
        },
        llmRequests: [],
        startTime: Date.now()
    };
    
    activeSessions.set(sessionId, session);
    
    // Send initial connection confirmation
    ws.send(JSON.stringify({
        type: 'connected',
        sessionId: sessionId,
        timestamp: Date.now()
    }));

    ws.on('message', async (data: any) => {
        try {
            const message = JSON.parse(data.toString());
            await handleClientMessage(session, message);
        } catch (error) {
            console.error('Error handling client message:', error);
            ws.send(JSON.stringify({
                type: 'error',
                error: `Failed to process message: ${error instanceof Error ? error.message : String(error)}`
            }));
        }
    });

    ws.on('close', () => {
        console.log(`🔌 Task demo connection closed: ${sessionId}`);
        
        // Clean up running task
        if (session.abortController) {
            session.abortController.abort();
        }
        
        activeSessions.delete(sessionId);
    });

    ws.on('error', (error: any) => {
        console.error(`WebSocket error for session ${sessionId}:`, error);
    });
});

async function handleClientMessage(session: TaskSession, message: any) {
    switch (message.type) {
        case 'start_task':
            await startTask(session, message.config);
            break;
        case 'stop_task':
            stopTask(session);
            break;
        case 'get_status':
            sendStatus(session);
            break;
        case 'get_llm_request':
            sendLLMRequestDetails(session, message.requestId);
            break;
        default:
            console.log('Unknown message type:', message.type);
    }
}

async function startTask(session: TaskSession, config: any) {
    try {
        // Clean up any existing task
        if (session.abortController) {
            session.abortController.abort();
        }
        
        session.abortController = new AbortController();
        session.config = config;
        
        // Reset metrics
        session.metrics = {
            messageCount: 0,
            requestCount: 0,
            metamemoryTriggers: 0,
            metacognitionTriggers: 0
        };
        session.llmRequests = [];
        session.startTime = Date.now();
        
        // Create agent with demo tools
        const demoTools = createDemoTools();
        session.agent = new Agent({
            name: config.agentName || 'TaskDemoAgent',
            modelClass: config.modelClass || 'mini',
            instructions: `You are a helpful AI assistant demonstrating the Task framework. You have access to various tools for web search, file operations, data analysis, planning, and more. Use these tools as needed to complete the task thoroughly. Be detailed in your work and use multiple tools when appropriate. When you have fully completed the task, use the task_complete tool with a comprehensive summary.`,
            tools: demoTools
        });

        // Set up event tracking
        const eventTracker = new TaskEventTracker(session);
        
        // Set active session for logger
        logger.setActiveSession(session);
        
        // Configure initial state with metamemory and metacognition
        const initialState: InitialTaskState = {
            metamemoryEnabled: config.metamemoryEnabled || false,
            metaFrequency: config.metaFrequency || '10',
            thoughtDelay: config.thoughtDelay || '1'
        };
        
        // Configure metamemory options if enabled
        if (config.metamemoryEnabled && config.metamemoryOptions) {
            // Note: We'd need to expose metamemory configuration in the Task API
            // For now, we'll use defaults and note this for enhancement
        }

        // Send start confirmation
        session.ws.send(JSON.stringify({
            type: 'task_started',
            config: config,
            timestamp: Date.now()
        }));

        // Run the task
        session.taskGenerator = runTask(session.agent, config.taskDescription, initialState);
        
        // Process events
        try {
            for await (const event of session.taskGenerator!) {
                // Check if task was aborted
                if (session.abortController?.signal.aborted) {
                    break;
                }
                
                await handleTaskEvent(session, event, eventTracker);
            }
        } catch (error) {
            if (!session.abortController?.signal.aborted) {
                console.error('Error in task execution:', error);
                session.ws.send(JSON.stringify({
                    type: 'error',
                    error: `Task execution failed: ${error instanceof Error ? error.message : String(error)}`
                }));
            }
        } finally {
            eventTracker.cleanup();
            logger.setActiveSession(null);
        }
        
    } catch (error) {
        console.error('Error starting task:', error);
        session.ws.send(JSON.stringify({
            type: 'error',
            error: `Failed to start task: ${error instanceof Error ? error.message : String(error)}`
        }));
    }
}

async function handleTaskEvent(session: TaskSession, event: any, _eventTracker: TaskEventTracker) {
    // Track specific events for metrics
    switch (event.type) {
        case 'response_output':
            session.metrics.messageCount++;
            break;
            
        case 'task_complete':
        case 'task_fatal_error':
            // Extract and send metamemory state for final visualization
            if (event.finalState?.metamemoryState) {
                session.ws.send(JSON.stringify({
                    type: 'metamemory_final_state',
                    state: {
                        threads: event.finalState.metamemoryState.threads ? 
                            Object.fromEntries(event.finalState.metamemoryState.threads) : {},
                        metamemory: event.finalState.metamemoryState.metamemory ?
                            Object.fromEntries(event.finalState.metamemoryState.metamemory) : {},
                        lastProcessedIndex: event.finalState.metamemoryState.lastProcessedIndex,
                        lastProcessedTime: event.finalState.metamemoryState.lastProcessedTime
                    },
                    timestamp: Date.now()
                }));
            }
            break;
    }
    
    // Forward all events to client with sessionId and timestamp
    const enhancedEvent = {
        ...event,
        sessionId: session.id,
        timestamp: Date.now()
    };
    session.ws.send(JSON.stringify(enhancedEvent));
    
    // Send updated metrics
    session.ws.send(JSON.stringify({
        type: 'metrics_update',
        metrics: session.metrics,
        timestamp: Date.now()
    }));
}

function stopTask(session: TaskSession) {
    if (session.abortController) {
        session.abortController.abort();
        session.abortController = undefined;
    }
    
    session.ws.send(JSON.stringify({
        type: 'task_stopped',
        timestamp: Date.now()
    }));
}

function sendStatus(session: TaskSession) {
    const isRunning = session.taskGenerator !== undefined && session.abortController !== undefined;
    
    session.ws.send(JSON.stringify({
        type: 'status',
        isRunning: isRunning,
        metrics: session.metrics,
        uptime: Date.now() - session.startTime,
        llmRequestCount: session.llmRequests.length,
        timestamp: Date.now()
    }));
}

function sendLLMRequestDetails(session: TaskSession, requestId: string) {
    const request = llmRequests.get(requestId);
    
    if (request) {
        session.ws.send(JSON.stringify({
            type: 'llm_request_details',
            requestId,
            data: request
        }));
    } else {
        session.ws.send(JSON.stringify({
            type: 'error',
            error: `LLM request ${requestId} not found`
        }));
    }
}

// Start the server
server.listen(PORT, () => {
    console.log(`🚀 Task Demo Server running on http://localhost:${PORT}`);
    console.log(`📊 Open http://localhost:${PORT}/task-demo-client.html for the demo`);
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
    
    // Close all WebSocket connections
    activeSessions.forEach(session => {
        if (session.abortController) {
            session.abortController.abort();
        }
        if (session.ws && session.ws.readyState === 1) {
            session.ws.close();
        }
    });
    
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