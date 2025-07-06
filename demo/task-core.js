import { runTask } from '../dist/index.js';
import { Agent, ensembleRequest, createToolFunction } from '@just-every/ensemble';

export async function generateMockResponse(toolName, args, context) {
  try {
    const mockAgent = new Agent({
      name: 'MockResponseGenerator',
      modelClass: 'mini',
      instructions: `You are generating realistic mock data for a tool called "${toolName}".
                    Generate a brief, realistic response based on the provided arguments.
                    Keep responses concise but informative. Use realistic data formats.`
    });

    const prompt = `Generate a mock response for ${toolName} with arguments: ${JSON.stringify(args, null, 2)}\n                   Context: ${context}\n\n                   Provide a realistic response that would be returned by this tool.`;

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
  } catch {
    return `Mock ${toolName} result: Successfully processed ${JSON.stringify(args)}`;
  }
}

export function createDemoTools() {
  return [
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
      { url: { type: 'string', description: 'URL to fetch' } },
      undefined,
      'fetch_page'
    ),
    createToolFunction(
      async (path) => {
        return await generateMockResponse('read_file', { path },
          'Reads a file from the filesystem and returns its contents');
      },
      'Read a file from the filesystem',
      { path: { type: 'string', description: 'File path to read' } },
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
    createToolFunction(
      async (expression) => {
        try {
          const result = eval(expression.replace(/[^0-9+\-*/().\s]/g, ''));
          return `Result: ${result}`;
        } catch {
          return await generateMockResponse('calculate', { expression },
            'Evaluates mathematical expressions and returns the result');
        }
      },
      'Calculate mathematical expressions',
      { expression: { type: 'string', description: 'Mathematical expression to evaluate' } },
      undefined,
      'calculate'
    )
  ];
}

function createDemoAgent() {
  return new Agent({
    name: 'TaskDemoAgent',
    modelClass: 'standard',
    instructions: `You are a helpful AI assistant demonstrating the Task framework. You have access to various tools for web search, file operations, data analysis, planning, and more. Use these tools as needed to complete the task thoroughly. Be detailed in your work and use multiple tools when appropriate. When you have fully completed the task, use the task_complete tool with a comprehensive summary.`,
    tools: createDemoTools()
  });
}

export function startDemoTask(prompt, send) {
  const controller = new AbortController();
  (async () => {
    send({ type: 'status', status: 'running' });

    const agent = createDemoAgent();
    const mainThreadId = 'main-thread';
    const threads = new Map();
    const metamemoryThreads = new Map();
    let messageCount = 0;
    let toolCallCount = 0;

    threads.set(mainThreadId, { id: mainThreadId, name: 'Main Conversation', type: 'main', messages: [] });
    send({ type: 'thread', id: mainThreadId, name: 'Main Conversation', threadType: 'main', messages: [] });
    send({ type: 'message', id: `msg-${++messageCount}`, role: 'user', content: prompt, threadId: mainThreadId, timestamp: Date.now() });

    let lastMessageRole = null;
    let lastMessageContent = [];
    let currentToolCall = null;
    let messageStartTime = Date.now();

    try {
      const taskGenerator = runTask(agent, prompt, { metamemoryEnabled: true, processInterval: 2, windowSize: 10, metaFrequency: 10 });
      for await (const event of taskGenerator) {
        if (controller.signal.aborted) break;
        switch (event.type) {
          case 'message_start':
            lastMessageRole = event.message?.role || 'assistant';
            lastMessageContent = [];
            messageStartTime = Date.now();
            break;
          case 'message_delta':
            if (event.content) lastMessageContent.push(event.content);
            break;
          case 'message_done':
            const full = lastMessageContent.join('');
            if (full) {
              const id = `msg-${++messageCount}`;
              send({ type: 'message', id, role: lastMessageRole, content: full, threadId: mainThreadId, timestamp: Date.now() });
            }
            break;
          case 'thinking':
            if (event.content) {
              send({ type: 'thinking', content: event.content, threadId: mainThreadId, thinkingType: 'reasoning' });
            }
            break;
          case 'tool_start':
            if (event.tool_call) {
              currentToolCall = { id: event.tool_call.id || `tool-${++toolCallCount}`, name: event.tool_call.function?.name, arguments: event.tool_call.function?.arguments };
              send({ type: 'tool_call', ...currentToolCall, threadId: mainThreadId });
            }
            break;
          case 'tool_done':
            if (currentToolCall && event.result) {
              send({ type: 'tool_result', toolId: currentToolCall.id, result: event.result.output, duration: Date.now() - messageStartTime });
            }
            if (event.tool_call?.function?.name === 'task_complete') {
              send({ type: 'status', status: 'completed', result: event.result?.output });
            } else if (event.tool_call?.function?.name === 'task_fatal_error') {
              send({ type: 'error', message: event.result?.output });
              send({ type: 'status', status: 'error' });
            }
            break;
          case 'metamemory_processing':
            if (event.data) {
              const tid = `metamemory-${event.data.threadClass || 'unknown'}`;
              if (!metamemoryThreads.has(tid)) {
                metamemoryThreads.set(tid, { id: tid, name: event.data.threadClass || 'Metamemory', size: 0, overlap: new Set(), messages: [] });
              }
              const thread = metamemoryThreads.get(tid);
              thread.size++;
              send({ type: 'thread', id: tid, name: thread.name, threadType: 'metamemory', metadata: { triggerReason: event.data.trigger } });
            }
            break;
          case 'metacognition_trigger':
            if (event.data) {
              send({ type: 'thinking', content: event.data.reasoning, threadId: 'metacognition', thinkingType: 'reflection' });
              send({ type: 'thread', id: 'metacognition', name: 'Metacognition', threadType: 'metacognition', metadata: { triggerReason: event.data.trigger } });
            }
            break;
          case 'error':
            send({ type: 'error', message: event.error || 'Unknown error' });
            break;
        }
      }

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
      send({ type: 'meta_analysis', analysis: metaAnalysis });
      send({ type: 'status', status: 'completed' });
    } catch (err) {
      send({ type: 'error', message: err.message });
      send({ type: 'status', status: 'error' });
    }
  })();
  return { abort: () => controller.abort() };
}

