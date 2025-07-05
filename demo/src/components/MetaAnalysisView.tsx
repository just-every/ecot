import { useState } from 'react'
import { Card, GlassButton, StatsGrid, TabGroup, TabPanel } from '@just-every/demo-ui'
import { MetaAnalysis } from '../types'
import './MetaAnalysisView.scss'

interface MetaAnalysisViewProps {
  analysis: MetaAnalysis
}

export default function MetaAnalysisView({ analysis }: MetaAnalysisViewProps) {
  const [activeTab, setActiveTab] = useState<'overview' | 'threads' | 'metacognition'>('overview')
  const [expandedThread, setExpandedThread] = useState<string | null>(null)
  const [expandedMeta, setExpandedMeta] = useState<string | null>(null)

  const renderOverview = () => (
    <div className="overview-section">
      <StatsGrid
        stats={[
          { label: 'Total Threads', value: analysis.summary.totalThreads.toString(), icon: '🧪' },
          { label: 'Total Messages', value: analysis.summary.totalMessages.toString(), icon: '💬' },
          { label: 'Avg Overlap', value: `${(analysis.summary.avgOverlap * 100).toFixed(1)}%`, icon: '🔗' },
          { label: 'Most Active', value: analysis.summary.mostActiveThread, icon: '🏆' }
        ]}
      />

      <Card className="insights">
        <h3 style={{ fontSize: '16px', fontWeight: '600', marginBottom: '12px' }}>Key Insights</h3>
        <ul style={{ margin: 0, paddingLeft: '20px', color: 'var(--text-secondary)' }}>
          <li>The system processed {analysis.threads.length} distinct memory threads</li>
          <li>Metacognition was triggered {analysis.metacognition.length} times</li>
          <li>Thread overlap indicates {analysis.summary.avgOverlap > 0.3 ? 'high' : 'moderate'} contextual integration</li>
        </ul>
      </Card>
    </div>
  )

  const renderThreads = () => (
    <div className="threads-section">
      {analysis.threads.map((thread) => (
        <Card key={thread.id} className="thread-card">
          <div className="thread-header">
            <div className="thread-info">
              <h4>{thread.name}</h4>
              <div className="thread-stats">
                <span className="stat">
                  <span className="icon">📝</span> {thread.messages.length} messages
                </span>
                <span className="stat">
                  <span className="icon">🔗</span> {thread.overlap.size} overlaps
                </span>
              </div>
            </div>
            <GlassButton
              onClick={() => setExpandedThread(
                expandedThread === thread.id ? null : thread.id
              )}
              style={{ fontSize: '14px' }}
            >
              {expandedThread === thread.id ? 'Collapse' : 'Expand'}
            </GlassButton>
          </div>

          {expandedThread === thread.id && (
            <div className="thread-details">
              <div className="messages-list">
                <h5>Messages</h5>
                {thread.messages.map((message, index) => (
                  <div key={index} className="message-item">
                    <span className="message-role">{message.role}</span>
                    <span className="message-content">
                      {message.content.substring(0, 100)}...
                    </span>
                  </div>
                ))}
              </div>
              
              {thread.overlap.size > 0 && (
                <div className="overlap-info">
                  <h5>Overlapping Threads</h5>
                  <div className="overlap-list">
                    {Array.from(thread.overlap).map((overlapId) => {
                      const overlappingThread = analysis.threads.find(t => t.id === overlapId)
                      return overlappingThread ? (
                        <span key={overlapId} className="overlap-item">
                          {overlappingThread.name}
                        </span>
                      ) : null
                    })}
                  </div>
                </div>
              )}
            </div>
          )}
        </Card>
      ))}
    </div>
  )

  const renderMetacognition = () => (
    <div className="metacognition-section">
      {analysis.metacognition.map((meta) => (
        <Card key={meta.id} className="meta-card">
          <div className="meta-header">
            <div className="meta-info">
              <h4>Trigger: {meta.trigger}</h4>
              <span className="timestamp">
                {new Date(meta.timestamp).toLocaleTimeString()}
              </span>
            </div>
            <GlassButton
              onClick={() => setExpandedMeta(
                expandedMeta === meta.id ? null : meta.id
              )}
              style={{ fontSize: '14px' }}
            >
              {expandedMeta === meta.id ? 'Collapse' : 'Expand'}
            </GlassButton>
          </div>

          {expandedMeta === meta.id && (
            <div className="meta-details">
              <div className="detail-section">
                <h5>Reasoning</h5>
                <p>{meta.reasoning}</p>
              </div>
              <div className="detail-section">
                <h5>Decision</h5>
                <p>{meta.decision}</p>
              </div>
              <div className="detail-section">
                <h5>Impact</h5>
                <p>{meta.impact}</p>
              </div>
            </div>
          )}
        </Card>
      ))}
    </div>
  )

  const tabs = [
    { id: 'overview', label: 'Overview' },
    { id: 'threads', label: `Threads (${analysis.threads.length})` },
    { id: 'metacognition', label: `Metacognition (${analysis.metacognition.length})` }
  ]

  return (
    <div className="meta-analysis-view">
      <TabGroup
        tabs={tabs}
        activeTab={activeTab}
        onTabChange={(tab) => setActiveTab(tab as any)}
      >
        <TabPanel id="overview">
          {renderOverview()}
        </TabPanel>
        <TabPanel id="threads">
          {renderThreads()}
        </TabPanel>
        <TabPanel id="metacognition">
          {renderMetacognition()}
        </TabPanel>
      </TabGroup>
    </div>
  )
}