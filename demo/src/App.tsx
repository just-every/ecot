import { useState, useCallback, useEffect, useRef } from 'react'
import {
  Card,
  ShowCodeButton,
  formatNumber,
  formatCurrency,
  LLMRequestLog,
  Conversation,
  CognitionView,
  MemoryView,
  useTaskState
} from '@just-every/demo-ui'
import TaskExamples from './components/TaskExamples'
import TaskSettings from './components/TaskSettings'
import './App.scss'

type TabType = 'conversation' | 'requests' | 'memory' | 'cognition'

function App() {
  const [selectedExample, setSelectedExample] = useState<string>('')
  const [customPrompt, setCustomPrompt] = useState('')
  const [activeTab, setActiveTab] = useState<TabType>('conversation')
  const [taskSettings, setTaskSettings] = useState({
    metaFrequency: '5',
    metamemoryEnabled: true
  })

  const [, setIsConnected] = useState(false)
  const [taskStatus, setTaskStatus] = useState<'idle' | 'running' | 'completed' | 'error'>('idle')
  const [, setTaskError] = useState<string | undefined>()
  const wsRef = useRef<WebSocket | null>(null)
  
  const { state: taskState, processEvent, reset } = useTaskState()
  
  // WebSocket connection management
  const connectWebSocket = useCallback((prompt: string, settings?: any) => {
    // Close existing connection if any
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    
    try {
      // Build URL with options
      const params = new URLSearchParams({
        prompt: prompt,
        ...(settings?.metaFrequency && { metaFrequency: settings.metaFrequency }),
        ...(settings?.metamemoryEnabled !== undefined && { metamemoryEnabled: String(settings.metamemoryEnabled) })
      });
      const wsUrl = `ws://localhost:3020/ws?${params.toString()}`;
      
      const ws = new WebSocket(wsUrl);
      
      ws.onopen = () => {
        console.log('WebSocket connected');
        setIsConnected(true);
        setTaskError(undefined);
      };
      
      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          
          // Process event through task state
          processEvent(data);
          
          // Handle task-specific events
          switch (data.type) {
            case 'task_start':
              setTaskStatus('running');
              setTaskError(undefined);
              break;
            case 'task_complete':
              setTaskStatus('completed');
              // Don't close yet - wait for all events
              break;
            case 'task_fatal_error':
              setTaskStatus('error');
              setTaskError(data.result || 'Task failed');
              break;
            case 'all_events_complete':
              // Now safe to close
              console.log('All events received, closing connection');
              ws.close();
              break;
            case 'error':
              setTaskStatus('error');
              setTaskError(data.message || 'Unknown error occurred');
              break;
          }
        } catch (error) {
          console.error('Error processing WebSocket message:', error);
        }
      };
      
      ws.onerror = (error) => {
        console.error('WebSocket error:', error);
        setIsConnected(false);
        setTaskStatus('error');
        setTaskError('WebSocket connection error');
      };
      
      ws.onclose = () => {
        console.log('WebSocket disconnected');
        setIsConnected(false);
        wsRef.current = null;
      };
      
      wsRef.current = ws;
    } catch (error) {
      console.error('Failed to connect WebSocket:', error);
      setIsConnected(false);
      setTaskStatus('error');
      setTaskError('Failed to connect to server');
    }
  }, [processEvent]);
  
  const runTask = useCallback((prompt: string, _taskId?: string, settings?: any) => {
    // Reset task state
    reset();
    
    // Add user message to display
    taskState.taskProcessor?.addUserMessage?.(prompt);
    
    setTaskStatus('running');
    setTaskError(undefined);
    
    // Connect with the prompt
    connectWebSocket(prompt, settings);
  }, [reset, connectWebSocket, taskState.taskProcessor]);
  
  const stopTask = useCallback(() => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'stop' }));
    }
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    setTaskStatus('completed');
    setIsConnected(false);
  }, []);
  
  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
    };
  }, []);
  

  const handleRunTask = useCallback(() => {
    const prompt = selectedExample || customPrompt
    if (!prompt) return

    runTask(prompt, undefined, taskSettings)
  }, [selectedExample, customPrompt, runTask, taskSettings])

  const handleStop = useCallback(() => {
    stopTask()
  }, [stopTask])

  // Handle URL routing
  useEffect(() => {
    // Check URL path on mount
    const path = window.location.pathname.substring(1) // Remove leading slash
    const validTabs: TabType[] = ['conversation', 'requests', 'memory', 'cognition']
    if (validTabs.includes(path as TabType)) {
      setActiveTab(path as TabType)
    }

    // Handle browser back/forward
    const handlePopState = () => {
      const path = window.location.pathname.substring(1)
      if (validTabs.includes(path as TabType)) {
        setActiveTab(path as TabType)
      }
    }

    window.addEventListener('popstate', handlePopState)
    return () => window.removeEventListener('popstate', handlePopState)
  }, [])

  // Handle tab changes
  const handleTabChange = (tab: TabType) => {
    setActiveTab(tab)
    // Update URL without page reload
    window.history.pushState(null, '', `/${tab}`)
  }

  // Handle initial task from environment variable
  useEffect(() => {
    const initialTask = import.meta.env.VITE_INITIAL_TASK
    if (initialTask && taskStatus === 'idle') {
      console.log('Running initial task:', initialTask)
      setCustomPrompt(initialTask)
      // Delay to ensure everything is loaded
      setTimeout(() => {
        runTask(initialTask, undefined, taskSettings)
      }, 2000)
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps


  return (
    <div style={{ display: 'flex', height: '100vh' }}>
      {/* Left Sidebar - Examples and Stats */}
      <div
        style={{
          width: '350px',
          padding: '20px',
          display: 'flex',
          flexDirection: 'column',
          gap: '20px',
          height: '100vh',
          overflow: 'auto'
        }}
      >
        <div style={{
          fontSize: '24px',
          fontWeight: '700',
          color: 'var(--accent-primary)',
          marginBottom: '20px',
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          padding: '16px 20px',
          borderRadius: '12px',
          backdropFilter: 'blur(10px)'
        }}>
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 576 512" width="24" height="24" fill="currentColor">
            <path d="M264.5 5.2c14.9-6.9 32.1-6.9 47 0l218.6 101c8.5 3.9 13.9 12.4 13.9 21.8s-5.4 17.9-13.9 21.8l-218.6 101c-14.9 6.9-32.1 6.9-47 0L45.9 149.8C37.4 145.8 32 137.3 32 128s5.4-17.9 13.9-21.8L264.5 5.2zM476.9 209.6l53.2 24.6c8.5 3.9 13.9 12.4 13.9 21.8s-5.4 17.9-13.9 21.8l-218.6 101c-14.9 6.9-32.1 6.9-47 0L45.9 277.8C37.4 273.8 32 265.3 32 256s5.4-17.9 13.9-21.8l53.2-24.6 152 70.2c23.4 10.8 50.4 10.8 73.8 0l152-70.2zm-152 198.2l152-70.2 53.2 24.6c8.5 3.9 13.9 12.4 13.9 21.8s-5.4 17.9-13.9 21.8l-218.6 101c-14.9 6.9-32.1 6.9-47 0L45.9 405.8C37.4 401.8 32 393.3 32 384s5.4-17.9 13.9-21.8l53.2-24.6 152 70.2c23.4 10.8 50.4 10.8 73.8 0z"></path>
          </svg>
          Task Demo
        </div>

        <Card>
          <TaskExamples
            selectedExample={selectedExample}
            onSelectExample={setSelectedExample}
            customPrompt={customPrompt}
            onCustomPromptChange={setCustomPrompt}
            onRunTask={handleRunTask}
            onStop={handleStop}
            isRunning={taskStatus === 'running'}
            canRun={!!(selectedExample || customPrompt)}
            compact
          />
        </Card>

        <TaskSettings onSettingsChange={setTaskSettings} />

        <Card>
          <div style={{ marginBottom: '16px', width: '100%' }}>
            <ShowCodeButton onClick={() => {}} />
          </div>

          <div style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: '8px'
          }}>
            {/* Core stats */}
            <div style={{
              flex: '1 1 80px',
              minWidth: '80px',
              padding: '12px',
              background: 'var(--surface-glass)',
              borderRadius: '8px',
              textAlign: 'center'
            }}>
              <div style={{ fontSize: '20px', fontWeight: '600', color: 'var(--text)', marginBottom: '4px' }}>
                {formatNumber(taskState.totalTokens)}
              </div>
              <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Tokens</div>
            </div>

            <div style={{
              flex: '1 1 80px',
              minWidth: '80px',
              padding: '12px',
              background: 'var(--surface-glass)',
              borderRadius: '8px',
              textAlign: 'center'
            }}>
              <div style={{ fontSize: '20px', fontWeight: '600', color: 'var(--text)', marginBottom: '4px' }}>
                {formatCurrency(taskState.totalCost)}
              </div>
              <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Cost</div>
            </div>

            <div style={{
              flex: '1 1 80px',
              minWidth: '80px',
              padding: '12px',
              background: 'var(--surface-glass)',
              borderRadius: '8px',
              textAlign: 'center'
            }}>
              <div style={{ fontSize: '20px', fontWeight: '600', color: 'var(--text)', marginBottom: '4px' }}>
                {taskState.llmRequests.length.toString()}
              </div>
              <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Requests</div>
            </div>

            {/* Metamemory stats */}
            <div style={{
              flex: '1 1 80px',
              minWidth: '80px',
              padding: '12px',
              background: 'var(--surface-glass)',
              borderRadius: '8px',
              textAlign: 'center'
            }}>
              <div style={{ fontSize: '20px', fontWeight: '600', color: 'var(--text)', marginBottom: '4px' }}>
                {taskState.memoryData?.stats?.totalTaggingSessions?.toString() || '0'}
              </div>
              <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Sessions</div>
            </div>

            <div style={{
              flex: '1 1 80px',
              minWidth: '80px',
              padding: '12px',
              background: 'var(--surface-glass)',
              borderRadius: '8px',
              textAlign: 'center'
            }}>
              <div style={{ fontSize: '20px', fontWeight: '600', color: 'var(--text)', marginBottom: '4px' }}>
                {taskState.memoryData?.stats?.totalTopics?.toString() || '0'}
              </div>
              <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Topics</div>
            </div>

            {/* Cognition stats */}
            <div style={{
              flex: '1 1 80px',
              minWidth: '80px',
              padding: '12px',
              background: 'var(--surface-glass)',
              borderRadius: '8px',
              textAlign: 'center'
            }}>
              <div style={{ fontSize: '20px', fontWeight: '600', color: 'var(--text)', marginBottom: '4px' }}>
                {taskState.cognitionData?.stats?.totalAnalyses?.toString() || '0'}
              </div>
              <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Analyses</div>
            </div>

            <div style={{
              flex: '1 1 80px',
              minWidth: '80px',
              padding: '12px',
              background: 'var(--surface-glass)',
              borderRadius: '8px',
              textAlign: 'center'
            }}>
              <div style={{ fontSize: '20px', fontWeight: '600', color: 'var(--text)', marginBottom: '4px' }}>
                {taskState.cognitionData?.stats?.completedAnalyses?.toString() || '0'}
              </div>
              <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Completed</div>
            </div>
          </div>
        </Card>
      </div>

      {/* Main Panel - Full Height Tabs */}
      <div style={{
        flex: 1,
        height: '100vh',
        display: 'flex',
        flexDirection: 'column',
        padding: '20px'
      }}>
        <Card style={{
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          padding: 0,
          overflow: 'hidden'
        }}>
          {/* Tab Navigation */}
          <div style={{
            display: 'flex',
            gap: '8px',
            padding: '16px 20px',
            borderBottom: '1px solid var(--border-glass)',
            background: 'rgba(255, 255, 255, 0.02)'
          }}>
            <button
              className={`nav-tab ${activeTab === 'conversation' ? 'active' : ''}`}
              onClick={() => handleTabChange('conversation')}
              title="💬Conversation"
              style={{
                border: 'none',
                background: activeTab === 'conversation'
                  ? 'linear-gradient(135deg, rgba(74, 158, 255, 0.2), rgba(74, 158, 255, 0.1))'
                  : 'var(--surface-glass)',
                color: activeTab === 'conversation' ? 'var(--accent-primary)' : 'var(--text-secondary)',
                padding: '10px 20px',
                borderRadius: '8px',
                cursor: 'pointer',
                fontSize: '15px',
                fontWeight: '500',
                transition: 'all 0.3s ease',
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}
            >
              💬 Conversation
            </button>

            <button
              className={`nav-tab ${activeTab === 'requests' ? 'active' : ''}`}
              onClick={() => handleTabChange('requests')}
              title="📊Requests"
              style={{
                border: 'none',
                background: activeTab === 'requests'
                  ? 'linear-gradient(135deg, rgba(74, 158, 255, 0.2), rgba(74, 158, 255, 0.1))'
                  : 'var(--surface-glass)',
                color: activeTab === 'requests' ? 'var(--accent-primary)' : 'var(--text-secondary)',
                padding: '10px 20px',
                borderRadius: '8px',
                cursor: 'pointer',
                fontSize: '15px',
                fontWeight: '500',
                transition: 'all 0.3s ease',
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}
            >
              📋 Requests {taskState.llmRequests.length > 0 && `(${taskState.llmRequests.length})`}
            </button>

            <button
              className={`nav-tab ${activeTab === 'memory' ? 'active' : ''}`}
              onClick={() => handleTabChange('memory')}
              title="🧠Memory"
              style={{
                border: 'none',
                background: activeTab === 'memory'
                  ? 'linear-gradient(135deg, rgba(74, 158, 255, 0.2), rgba(74, 158, 255, 0.1))'
                  : 'var(--surface-glass)',
                color: activeTab === 'memory' ? 'var(--accent-primary)' : 'var(--text-secondary)',
                padding: '10px 20px',
                borderRadius: '8px',
                cursor: 'pointer',
                fontSize: '15px',
                fontWeight: '500',
                transition: 'all 0.3s ease',
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}
            >
              🧠 Memory
            </button>

            <button
              className={`nav-tab ${activeTab === 'cognition' ? 'active' : ''}`}
              onClick={() => handleTabChange('cognition')}
              title="🔮Cognition"
              style={{
                border: 'none',
                background: activeTab === 'cognition'
                  ? 'linear-gradient(135deg, rgba(74, 158, 255, 0.2), rgba(74, 158, 255, 0.1))'
                  : 'var(--surface-glass)',
                color: activeTab === 'cognition' ? 'var(--accent-primary)' : 'var(--text-secondary)',
                padding: '10px 20px',
                borderRadius: '8px',
                cursor: 'pointer',
                fontSize: '15px',
                fontWeight: '500',
                transition: 'all 0.3s ease',
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}
            >
              🔮 Cognition
            </button>
          </div>

          {/* Tab Content */}
          <div style={{
            flex: 1,
            padding: '20px',
            overflow: 'auto',
            minHeight: 0
          }}>
            {activeTab === 'conversation' && (
              <div style={{ height: '100%' }}>
                <Conversation
                    taskState={taskState}
                    emptyMessage="No messages yet. Run a task to start the conversation."
                    />
                </div>
            )}

            {activeTab === 'requests' && (
              <div style={{ height: '100%' }}>
                <LLMRequestLog taskState={taskState} />
              </div>
            )}

            {activeTab === 'memory' && (
              <div style={{ height: '100%' }}>
                <MemoryView taskState={taskState} />
              </div>
            )}

            {activeTab === 'cognition' && (
              <div style={{ height: '100%' }}>
                <CognitionView taskState={taskState} />
              </div>
            )}
          </div>
        </Card>
      </div>
    </div>
  )
}

export default App