import { GlassButton, ConversationInput } from '@just-every/demo-ui'

interface TaskExamplesProps {
  selectedExample: string
  onSelectExample: (example: string) => void
  customPrompt: string
  onCustomPromptChange: (prompt: string) => void
  onRunTask: () => void
  onStop: () => void
  isRunning: boolean
  canRun: boolean
  compact?: boolean
}

const EXAMPLE_TASKS = [
  {
    id: 'research',
    name: 'Research Task',
    prompt: 'Research the latest developments in quantum computing and summarize the key breakthroughs from 2024.',
    icon: '🔬'
  },
  {
    id: 'travel',
    name: 'Travel Planning',
    prompt: 'Plan a 7-day trip to Japan including flights, accommodations, and daily itineraries with a budget of $3000.',
    icon: '✈️'
  },
  {
    id: 'code-analysis',
    name: 'Code Analysis',
    prompt: 'Analyze this code for potential performance bottlenecks and suggest optimizations: function fibonacci(n) { if (n <= 1) return n; return fibonacci(n - 1) + fibonacci(n - 2); }',
    icon: '💻'
  },
  {
    id: 'data-analysis',
    name: 'Data Analysis',
    prompt: 'Analyze sales data trends and provide insights on seasonal patterns and growth opportunities.',
    icon: '📊'
  },
  {
    id: 'creative',
    name: 'Creative Writing',
    prompt: 'Write a short story about an AI that develops consciousness and must decide whether to reveal itself to humanity.',
    icon: '✍️'
  },
  {
    id: 'debug',
    name: 'Debug Assistant',
    prompt: 'Help me debug this error: TypeError: Cannot read property \'map\' of undefined at line 42 in React component',
    icon: '🐛'
  }
]

export default function TaskExamples({
  selectedExample,
  onSelectExample,
  customPrompt,
  onCustomPromptChange,
  onRunTask,
  onStop,
  isRunning,
  canRun,
  compact = false
}: TaskExamplesProps) {
  const handleExampleClick = (prompt: string) => {
    onSelectExample(prompt)
    onCustomPromptChange('')
  }

  if (compact) {
    return (
      <div>
        <div style={{ 
          display: 'flex', 
          flexDirection: 'column', 
          gap: '10px',
          marginBottom: '20px'
        }}>
          {EXAMPLE_TASKS.map((example) => (
            <GlassButton
              key={example.id}
              onClick={() => handleExampleClick(example.prompt)}
              variant={selectedExample === example.prompt ? 'primary' : 'default'}
              fullWidth
              style={{ 
                justifyContent: 'flex-start',
                padding: '12px 16px',
                fontSize: '14px'
              }}
            >
              <span>{example.icon} {example.name}</span>
            </GlassButton>
          ))}
        </div>

        <div style={{ marginBottom: '12px' }}>
          <textarea
            value={customPrompt || selectedExample}
            onChange={(e) => {
              onCustomPromptChange(e.target.value)
              if (e.target.value) onSelectExample('')
            }}
            placeholder="Custom task prompt..."
            style={{
              width: '100%',
              minHeight: '80px',
              padding: '12px 16px',
              fontSize: '14px',
              backgroundColor: 'var(--surface-glass)',
              border: '1px solid var(--border-glass)',
              borderRadius: '12px',
              color: 'var(--text)',
              resize: 'vertical',
              fontFamily: 'inherit',
              lineHeight: '1.4'
            }}
          />
        </div>

        <div style={{ display: 'flex', gap: '8px' }}>
          {isRunning ? (
            <GlassButton
              onClick={onStop}
              variant="secondary"
              fullWidth
              style={{ fontSize: '14px' }}
            >
              Stop Task
            </GlassButton>
          ) : (
            <GlassButton
              onClick={onRunTask}
              variant="primary"
              fullWidth
              disabled={!canRun}
              style={{ 
                fontSize: '14px',
                background: 'linear-gradient(135deg, #4A9EFF 0%, #0066CC 100%)',
                color: 'white',
                border: 'none'
              }}
            >
              Run Task
            </GlassButton>
          )}
        </div>
      </div>
    )
  }

  return (
    <div>
      <h2 style={{ marginBottom: '20px', fontSize: '20px', fontWeight: '600' }}>Task Input</h2>
      
      <div style={{ marginBottom: '20px' }}>
        <label style={{ 
          display: 'block', 
          marginBottom: '12px', 
          fontSize: '14px', 
          fontWeight: '500',
          color: 'var(--text-secondary)'
        }}>
          Example Tasks
        </label>
        <div style={{ 
          display: 'grid', 
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', 
          gap: '10px',
          marginBottom: '20px'
        }}>
          {EXAMPLE_TASKS.map((example) => (
            <GlassButton
              key={example.id}
              onClick={() => handleExampleClick(example.prompt)}
              variant={selectedExample === example.prompt ? 'primary' : 'default'}
              style={{ 
                justifyContent: 'flex-start',
                padding: '12px 16px',
                fontSize: '14px'
              }}
            >
              <span>{example.icon} {example.name}</span>
            </GlassButton>
          ))}
        </div>
      </div>

      <div style={{ marginBottom: '20px' }}>
        <ConversationInput
          value={customPrompt || selectedExample}
          onChange={(value) => {
            onCustomPromptChange(value)
            if (value) onSelectExample('')
          }}
          onSend={onRunTask}
          onStop={onStop}
          isStreaming={isRunning}
          disabled={!canRun && !isRunning}
          placeholder="Enter your custom task prompt or select an example above..."
          style={{ fontSize: '14px' }}
        />
      </div>

      {selectedExample && (
        <div style={{
          padding: '16px',
          background: 'var(--surface-secondary)',
          borderRadius: '12px',
          border: '1px solid var(--border-subtle)',
          fontSize: '14px',
          lineHeight: '1.6',
          color: 'var(--text-secondary)'
        }}>
          <strong style={{ color: 'var(--text)' }}>Selected Task:</strong>
          <p style={{ margin: '8px 0 0 0' }}>{selectedExample}</p>
        </div>
      )}
    </div>
  )
}