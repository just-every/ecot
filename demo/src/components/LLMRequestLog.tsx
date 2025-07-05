import { useState } from 'react'
import { Card, GlassButton, StatsGrid, formatNumber, formatDuration } from '@just-every/demo-ui'
import { LLMRequest } from '../types'
import './LLMRequestLog.scss'

interface LLMRequestLogProps {
  requests: LLMRequest[]
}

export default function LLMRequestLog({ requests }: LLMRequestLogProps) {
  const [expandedRequest, setExpandedRequest] = useState<string | null>(null)

  const formatDurationSafe = (ms?: number) => {
    if (!ms) return 'N/A'
    return formatDuration(ms)
  }

  const formatTokens = (usage?: { promptTokens: number; completionTokens: number; totalTokens: number }) => {
    if (!usage) return 'N/A'
    return `${usage.promptTokens} → ${usage.completionTokens} (${usage.totalTokens} total)`
  }

  const totalTokens = requests.reduce((sum, req) => 
    sum + (req.response?.usage?.totalTokens || 0), 0
  )
  const totalDuration = requests.reduce((sum, req) => sum + (req.duration || 0), 0)

  return (
    <div className="llm-request-log">
      <StatsGrid
        stats={[
          { label: 'Total Requests', value: requests.length.toString(), icon: '📊' },
          { label: 'Total Tokens', value: formatNumber(totalTokens), icon: '🔤' },
          { label: 'Total Duration', value: formatDurationSafe(totalDuration), icon: '⏱️' },
          { label: 'Avg Tokens/Request', value: formatNumber(Math.round(totalTokens / requests.length || 0)), icon: '📈' }
        ]}
      />

      <div className="log-entries">
        {requests.map((request, index) => (
          <Card key={request.id} className="log-entry">
            <div className="entry-header">
              <div className="entry-info">
                <span className="entry-number">#{index + 1}</span>
                <span className="model-name">{request.model}</span>
                <span className="timestamp">
                  {new Date(request.timestamp).toLocaleTimeString()}
                </span>
              </div>
              <div className="entry-stats">
                <span className="duration">{formatDurationSafe(request.duration)}</span>
                <GlassButton
                  onClick={() => setExpandedRequest(
                    expandedRequest === request.id ? null : request.id
                  )}
                  style={{ fontSize: '14px' }}
                >
                  {expandedRequest === request.id ? 'Collapse' : 'Expand'}
                </GlassButton>
              </div>
            </div>

            {expandedRequest === request.id && (
              <div className="entry-details">
                <div className="detail-section">
                  <h4>Request Parameters</h4>
                  <div className="parameters">
                    <div className="param">
                      <span className="param-name">Temperature:</span>
                      <span className="param-value">{request.temperature || 'default'}</span>
                    </div>
                    <div className="param">
                      <span className="param-name">Max Tokens:</span>
                      <span className="param-value">{request.maxTokens || 'default'}</span>
                    </div>
                  </div>
                </div>

                <div className="detail-section">
                  <h4>Messages</h4>
                  <div className="messages">
                    {request.messages.map((msg, msgIndex) => (
                      <div key={msgIndex} className={`message message-${msg.role}`}>
                        <div className="message-role">{msg.role}</div>
                        <div className="message-content">{msg.content}</div>
                      </div>
                    ))}
                  </div>
                </div>

                {request.response && (
                  <div className="detail-section">
                    <h4>Response</h4>
                    <div className="response-content">
                      {request.response.content}
                    </div>
                    {request.response.usage && (
                      <div className="token-usage">
                        <span className="usage-label">Tokens:</span>
                        <span className="usage-value">
                          {formatTokens(request.response.usage)}
                        </span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </Card>
        ))}
      </div>
    </div>
  )
}