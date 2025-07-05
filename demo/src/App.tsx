import { useState, useCallback } from 'react'
import { 
  DemoHeader, 
  Card, 
  GlassButton, 
  ConnectionStatus,
  StatsGrid,
  ShowCodeButton,
  formatNumber,
  formatCurrency
} from '@just-every/demo-ui'
import ConversationView from './components/ConversationView'
import LLMRequestLog from './components/LLMRequestLog'
import MetaAnalysisView from './components/MetaAnalysisView'
import MemoryView from './components/MemoryView'
import TaskExamples from './components/TaskExamples'
import { useTaskRunner } from './hooks/useTaskRunner'
import { TaskState, LLMRequest, MetaAnalysis } from './types'
import './App.scss'

type TabType = 'conversation' | 'requests' | 'memory' | 'cognition'

function App() {
  const [taskState, setTaskState] = useState<TaskState | null>(null)
  const [llmRequests, setLLMRequests] = useState<LLMRequest[]>([])
  const [metaAnalysis, setMetaAnalysis] = useState<MetaAnalysis | null>(null)
  const [selectedExample, setSelectedExample] = useState<string>('')
  const [customPrompt, setCustomPrompt] = useState('')
  const [isRunning, setIsRunning] = useState(false)
  const [activeTab, setActiveTab] = useState<TabType>('conversation')
  const [totalTokens, setTotalTokens] = useState(0)
  const [totalCost, setTotalCost] = useState(0)

  const { runTask, stopTask } = useTaskRunner({
    onStateUpdate: setTaskState,
    onLLMRequest: (request) => {
      setLLMRequests(prev => {
        // Check if this is an update to an existing request
        const existingIndex = prev.findIndex(r => r.id === request.id)
        if (existingIndex >= 0) {
          // Update existing request
          const updated = [...prev]
          updated[existingIndex] = request
          return updated
        } else {
          // Add new request
          return [...prev, request]
        }
      })
      
      // Update stats when we have a response
      if (request.response?.usage) {
        setTotalTokens(prev => prev + (request.response?.usage?.totalTokens || 0))
        setTotalCost(prev => prev + ((request.response?.usage?.totalTokens || 0) * 0.00001)) // Mock cost calculation
      }
    },
    onMetaAnalysis: setMetaAnalysis,
  })

  const handleRunTask = useCallback(async () => {
    const prompt = selectedExample || customPrompt
    if (!prompt) return

    setIsRunning(true)
    setTaskState(null)
    setLLMRequests([])
    setMetaAnalysis(null)
    setTotalTokens(0)
    setTotalCost(0)

    try {
      await runTask(prompt)
    } catch (error) {
      console.error('Task failed:', error)
    } finally {
      setIsRunning(false)
    }
  }, [selectedExample, customPrompt, runTask])

  const handleStop = useCallback(() => {
    stopTask()
    setIsRunning(false)
  }, [stopTask])


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
          background: 'linear-gradient(135deg, rgba(74, 158, 255, 0.1), rgba(74, 158, 255, 0.05))',
          border: '1px solid rgba(74, 158, 255, 0.2)',
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
            isRunning={isRunning}
            canRun={!!(selectedExample || customPrompt)}
            compact
          />
        </Card>

        <Card>
          <div style={{ marginBottom: '16px' }}>
            <ShowCodeButton onClick={() => {}} disabled style={{ width: '100%' }} />
          </div>
          
          <div style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: '12px'
          }}>
            <div style={{
              padding: '12px',
              background: 'var(--surface-glass)',
              borderRadius: '8px',
              textAlign: 'center'
            }}>
              <div style={{ fontSize: '20px', fontWeight: '600', color: 'var(--text)', marginBottom: '4px' }}>
                {formatNumber(totalTokens)}
              </div>
              <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Tokens</div>
            </div>
            
            <div style={{
              padding: '12px',
              background: 'var(--surface-glass)',
              borderRadius: '8px',
              textAlign: 'center'
            }}>
              <div style={{ fontSize: '20px', fontWeight: '600', color: 'var(--text)', marginBottom: '4px' }}>
                {formatCurrency(totalCost)}
              </div>
              <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Cost</div>
            </div>
            
            <div style={{
              padding: '12px',
              background: 'var(--surface-glass)',
              borderRadius: '8px',
              textAlign: 'center'
            }}>
              <div style={{ fontSize: '20px', fontWeight: '600', color: 'var(--text)', marginBottom: '4px' }}>
                {llmRequests.length.toString()}
              </div>
              <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Requests</div>
            </div>
            
            <div style={{
              padding: '12px',
              background: 'var(--surface-glass)',
              borderRadius: '8px',
              textAlign: 'center'
            }}>
              <div style={{ fontSize: '20px', fontWeight: '600', color: 'var(--text)', marginBottom: '4px' }}>
                {taskState?.threads.length.toString() || '0'}
              </div>
              <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Threads</div>
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
              onClick={() => setActiveTab('conversation')}
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
              onClick={() => setActiveTab('requests')}
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
              📋 Requests {llmRequests.length > 0 && `(${llmRequests.length})`}
            </button>
            
            <button
              className={`nav-tab ${activeTab === 'memory' ? 'active' : ''}`}
              onClick={() => setActiveTab('memory')}
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
              onClick={() => setActiveTab('cognition')}
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
                {taskState ? (
                  <ConversationView
                    taskState={taskState}
                    isCompactView={false}
                  />
                ) : (
                  <div style={{ 
                    display: 'flex', 
                    alignItems: 'center', 
                    justifyContent: 'center',
                    height: '100%',
                    color: 'var(--text-secondary)'
                  }}>
                    No conversation yet. Run a task to start.
                  </div>
                )}
              </div>
            )}

            {activeTab === 'requests' && (
              <div style={{ height: '100%' }}>
                {llmRequests.length > 0 ? (
                  <LLMRequestLog requests={llmRequests} />
                ) : (
                  <div style={{ 
                    display: 'flex', 
                    alignItems: 'center', 
                    justifyContent: 'center',
                    height: '100%',
                    color: 'var(--text-secondary)'
                  }}>
                    No LLM requests yet.
                  </div>
                )}
              </div>
            )}
            
            {activeTab === 'memory' && (
              <div style={{ height: '100%' }}>
                <MemoryView threads={taskState?.threads || []} metaAnalysis={metaAnalysis} />
              </div>
            )}
            
            {activeTab === 'cognition' && (
              <div style={{ height: '100%', overflow: 'auto' }}>
                {metaAnalysis && metaAnalysis.metacognition.length > 0 ? (
                  <div style={{ padding: '20px' }}>
                    <h3 style={{ 
                      marginBottom: '20px', 
                      fontSize: '18px', 
                      fontWeight: '600',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px'
                    }}>
                      <span style={{ color: 'var(--metacognition)' }}>🔮</span>
                      Metacognition Analysis
                    </h3>
                    <MetaAnalysisView analysis={metaAnalysis} />
                  </div>
                ) : (
                  <div style={{ padding: '20px' }}>
                    <div style={{
                      textAlign: 'center',
                      color: 'var(--text-secondary)',
                      marginTop: '40px'
                    }}>
                      <div style={{ fontSize: '48px', marginBottom: '16px', opacity: 0.5 }}>🔮</div>
                      <p>No metacognition analysis available yet.</p>
                      <p style={{ fontSize: '14px', marginTop: '8px' }}>
                        Metacognition triggers periodically to analyze the task's progress and strategy.
                      </p>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </Card>
      </div>
    </div>
  )
}

export default App