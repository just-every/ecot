import { runTask, resumeTask } from '../dist/index.js';
import { Agent, ensembleRequest, createToolFunction } from '@just-every/ensemble';

export async function generateMockResponse(toolName, args, context, send = null) {
  try {
    const mockAgent = new Agent({
      name: 'MockResponseGenerator',
      modelClass: 'mini',
      tags: ['mock_api'],
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
    const startTime = Date.now();
    for await (const event of ensembleRequest(messages, mockAgent)) {
      if (event.type === 'message_delta' && event.content) {
        response += event.content;
      }
    }

    return response || `Mock result for ${toolName}`;
  } catch (error) {
    return `Mock ${toolName} result: Successfully processed ${JSON.stringify(args)}`;
  }
}

function extractTopicsFromContent(content) {
  // Simple topic extraction based on keywords
  const topics = [];
  const lowerContent = content.toLowerCase();

  // Define topic patterns
  const topicPatterns = [
    { pattern: /machine learning|ml|neural|ai|artificial intelligence/i, topic: 'Machine Learning' },
    { pattern: /quantum|qubit|superposition|entanglement/i, topic: 'Quantum Computing' },
    { pattern: /react|vue|angular|framework|component/i, topic: 'Web Frameworks' },
    { pattern: /recursion|algorithm|data structure|complexity/i, topic: 'Programming Concepts' },
    { pattern: /travel|flight|hotel|destination/i, topic: 'Travel Planning' },
    { pattern: /weather|temperature|forecast|climate/i, topic: 'Weather Information' },
    { pattern: /code|programming|software|development/i, topic: 'Software Development' },
    { pattern: /analysis|data|statistics|metrics/i, topic: 'Data Analysis' }
  ];

  topicPatterns.forEach(({ pattern, topic }) => {
    if (pattern.test(content) && !topics.includes(topic)) {
      topics.push(topic);
    }
  });

  // If no specific topics found, extract from first sentence
  if (topics.length === 0 && content.length > 20) {
    const firstSentence = content.split(/[.!?]/)[0];
    if (firstSentence.length < 50) {
      topics.push(firstSentence.trim());
    }
  }

  return topics.slice(0, 3); // Return max 3 topics
}

export function createDemoTools(send = null) {
  return [
    createToolFunction(
      async (query, options = {}) => {
        const results = options.max_results || 5;
        return await generateMockResponse('web_search', { query, results },
          'Web search tool that returns relevant search results with titles, URLs, and snippets', send);
      },
      'Search the web for information',
      {
        query: { type: 'string', description: 'Search query' },
        options: {
          type: 'object',
          properties: {
            max_results: { type: 'number', description: 'Maximum number of results (default: 5)', default: 5 }
          },
          optional: true
        }
      },
      undefined,
      'web_search'
    ),
    createToolFunction(
      async (url) => {
        return await generateMockResponse('fetch_page', { url },
          'Fetches and extracts content from a web page, returning the main text content', send);
      },
      'Fetch and extract content from a web page',
      { url: { type: 'string', description: 'URL to fetch' } },
      undefined,
      'fetch_page'
    ),
    createToolFunction(
      async (path) => {
        return await generateMockResponse('read_file', { path },
          'Reads a file from the filesystem and returns its contents', send);
      },
      'Read a file from the filesystem',
      { path: { type: 'string', description: 'File path to read' } },
      undefined,
      'read_file'
    ),
    createToolFunction(
      async (code, language) => {
        return await generateMockResponse('analyze_code', { code, language },
          'Analyzes code for issues, patterns, complexity, and suggestions', send);
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
          'Gets weather forecast for a location, including temperature, conditions, precipitation', send);
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
          'Searches for available flights between cities with prices and times', send);
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
          'Searches for available hotels with ratings, prices, and amenities', send);
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
            'Evaluates mathematical expressions and returns the result', send);
        }
      },
      'Calculate mathematical expressions',
      { expression: { type: 'string', description: 'Mathematical expression to evaluate' } },
      undefined,
      'calculate'
    )
  ];
}

function createDemoAgent(send = null) {
  return new Agent({
    name: 'TaskDemoAgent',
    modelClass: 'standard',
    instructions: `You are a helpful AI assistant demonstrating the Task framework. You have access to various tools for web search, file operations, data analysis, planning, and more. Use these tools as needed to complete the task thoroughly. Be detailed in your work and use multiple tools when appropriate. When you have fully completed the task, use the task_complete tool with a comprehensive summary.\n\nYour knowledge cut off is from a past date. Today's date is ${new Date().toLocaleDateString()}.`,
    tools: createDemoTools(send)
  });
}

export function startDemoTask(prompt, send, options = {}) {
  const controller = new AbortController();
  (async () => {
    try {
        const agent = createDemoAgent(send);

        // Convert options to taskLocalState format
        const taskLocalState = {
            cognition: {
                frequency: options.metaFrequency || 10
            },
            memory: {
                enabled: options.metamemoryEnabled !== false
            }
        };

        // Use resumeTask if we have a finalState, otherwise use runTask
        const taskGenerator = options.isResume && options.finalState
          ? resumeTask(agent, options.finalState, prompt)
          : runTask(agent, prompt, taskLocalState);

        // Simply pipe all events directly to the client
        for await (const event of taskGenerator) {
            if (controller.signal.aborted) break;

            // Send the event as-is to the client
            send(event);
        }

        // All events have been sent, signal completion
        console.log('[Demo] All events sent, closing connection');
        send({ type: 'all_events_complete' });
    } catch (err) {
      send({ type: 'error', error: err.message });
    }
  })();
  return { abort: () => controller.abort() };
}

