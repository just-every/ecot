# Task Demo

This demo showcases the advanced features of the Task framework including metamemory, metacognition, and complex multi-tool workflows.

## Features Implemented

### 1. Complex Example Tasks
Six pre-configured example tasks that demonstrate extended tool usage:

- **🔍 Research & Summarize**: Multi-step research workflow using web search and content analysis
- **✈️ Plan a Trip**: Complete travel planning with flights, hotels, weather, and itinerary
- **💻 Analyze Code**: Architecture review with performance and security analysis
- **📊 Data Analysis**: Sales data analysis with trends and visualizations
- **✍️ Creative Writing**: AI-themed story generation with plot and character development
- **🐛 Debug Issue**: Systematic debugging of intermittent login failures

### 2. Mock Tools with AI-Generated Responses
16 demo tools that simulate real-world functionality:

**Web/Research Tools:**
- `web_search`: Search the web with realistic results
- `fetch_page`: Extract content from web pages

**File/Code Tools:**
- `read_file`: Read file contents
- `analyze_code`: Code quality and performance analysis
- `write_file`: Write content to files
- `list_files`: Directory listing

**Data Analysis Tools:**
- `analyze_data`: Statistical analysis and insights
- `create_chart`: Data visualization

**Planning/Travel Tools:**
- `check_weather`: Weather forecasts
- `search_flights`: Flight availability and pricing
- `search_hotels`: Hotel search with ratings

**Database/API Tools:**
- `query_database`: Execute SQL queries
- `call_api`: Make API requests

**Communication Tools:**
- `translate_text`: Language translation
- `draft_email`: Email composition

**Utility Tools:**
- `calculate`: Mathematical calculations

### 3. Enhanced UI Features

**Streaming Support:**
- Real-time message deltas during content generation
- Typing indicator when model is processing
- Separate display for thinking content

**Tool Visualization:**
- Clear display of tool calls with formatted arguments
- Highlighted results for task completion and errors
- Special styling for task_complete and task_fatal_error

**Example Task Buttons:**
- One-click task selection
- Automatic configuration of optimal settings
- Task-specific thought delays and metamemory settings

### 4. Comprehensive Event Tracking
- All LLM requests with full details
- Metamemory thread visualization
- Metacognition trigger tracking
- Real-time metrics updates

## Usage

1. Start the demo server:
   ```bash
   npm run demo:task
   ```

2. Open http://localhost:3010/task-demo-client.html

3. Click an example task button or enter your own task

4. Configure settings:
   - **Metamemory**: Enable for long conversations
   - **Meta-frequency**: How often to trigger self-reflection (5, 10, 20, or 40 requests)
   - **Thought delay**: Pause between thoughts (0-128 seconds)

5. Click "Start Task" and watch the AI work through multiple tools

## Architecture

The demo tools use mini models to generate realistic mock responses, simulating real API calls without actual external dependencies. This allows for:
- Consistent demonstration of multi-tool workflows
- No external API requirements
- Realistic response generation based on context
- Fast iteration and testing

## Example Workflow

When you select "Research & Summarize", the agent will:
1. Call `web_search` to find recent quantum computing developments
2. Use `fetch_page` to extract content from multiple sources
3. Call `analyze_data` to identify trends
4. Use `draft_email` or similar tools to format findings
5. Complete with `task_complete` containing a comprehensive summary

Throughout this process:
- Metamemory tracks conversation threads
- Metacognition may adjust strategy based on findings
- All LLM requests are logged with full details
- The UI shows real-time progress with tool calls
EOF < /dev/null
