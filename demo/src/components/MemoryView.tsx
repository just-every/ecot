import { Card } from '@just-every/demo-ui'
import { Thread, MetaAnalysis } from '../types'
import VennDiagram from './VennDiagram'

interface MemoryViewProps {
  threads: Thread[]
  metaAnalysis: MetaAnalysis | null
}

export default function MemoryView({ threads, metaAnalysis }: MemoryViewProps) {
  const metamemoryThreads = threads.filter(t => t.type === 'metamemory')
  
  return (
    <div style={{ height: '100%', overflow: 'auto', padding: '20px' }}>
      {/* Venn Diagram Section */}
      {metaAnalysis && metaAnalysis.threads.length > 0 && (
        <div style={{ marginBottom: '32px' }}>
          <h3 style={{ 
            marginBottom: '20px', 
            fontSize: '18px', 
            fontWeight: '600',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}>
            <span style={{ color: 'var(--metamemory)' }}>🧵</span>
            Thread Overlap Visualization
          </h3>
          <VennDiagram threads={metaAnalysis.threads} />
        </div>
      )}

      {/* Thread Details */}
      <div>
        <h3 style={{ 
          marginBottom: '16px', 
          fontSize: '18px', 
          fontWeight: '600',
          display: 'flex',
          alignItems: 'center',
          gap: '8px'
        }}>
          <span style={{ color: 'var(--metamemory)' }}>📚</span>
          Metamemory Threads ({metamemoryThreads.length})
        </h3>
        
        {metamemoryThreads.length === 0 ? (
          <Card style={{ textAlign: 'center', color: 'var(--text-secondary)' }}>
            No metamemory threads created yet. Threads are created as the conversation progresses.
          </Card>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {metamemoryThreads.map(thread => (
              <Card key={thread.id} style={{ 
                padding: '16px',
                background: 'var(--surface-glass)',
                borderLeft: '4px solid var(--accent-primary)'
              }}>
                <div style={{ marginBottom: '12px' }}>
                  <h4 style={{ 
                    fontSize: '16px', 
                    fontWeight: '600',
                    marginBottom: '4px',
                    color: 'var(--accent-primary)'
                  }}>
                    {thread.name}
                  </h4>
                  <div style={{ 
                    fontSize: '14px', 
                    color: 'var(--text-secondary)' 
                  }}>
                    {thread.messages.length} messages
                  </div>
                </div>
                
                {thread.metadata?.overlap && thread.metadata.overlap.length > 0 && (
                  <div style={{ 
                    padding: '8px 12px',
                    background: 'rgba(74, 158, 255, 0.1)',
                    borderRadius: '8px',
                    fontSize: '13px'
                  }}>
                    <strong>Overlaps with:</strong> {thread.metadata.overlap.join(', ')}
                  </div>
                )}
                
                {thread.metadata?.triggerReason && (
                  <div style={{ 
                    marginTop: '8px',
                    fontSize: '13px',
                    color: 'var(--text-secondary)',
                    fontStyle: 'italic'
                  }}>
                    Trigger: {thread.metadata.triggerReason}
                  </div>
                )}
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Summary Statistics */}
      {metaAnalysis?.summary && (
        <div style={{ marginTop: '32px' }}>
          <h3 style={{ 
            marginBottom: '16px', 
            fontSize: '18px', 
            fontWeight: '600',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}>
            📊 Memory Statistics
          </h3>
          <div style={{ 
            display: 'grid', 
            gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', 
            gap: '12px' 
          }}>
            <Card style={{ 
              padding: '16px', 
              textAlign: 'center',
              background: 'var(--surface-glass)'
            }}>
              <div style={{ 
                fontSize: '24px', 
                fontWeight: '600', 
                color: 'var(--accent-primary)' 
              }}>
                {metaAnalysis.summary.totalThreads}
              </div>
              <div style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>
                Total Threads
              </div>
            </Card>
            
            <Card style={{ 
              padding: '16px', 
              textAlign: 'center',
              background: 'var(--surface-glass)'
            }}>
              <div style={{ 
                fontSize: '24px', 
                fontWeight: '600', 
                color: 'var(--accent-primary)' 
              }}>
                {metaAnalysis.summary.totalMessages}
              </div>
              <div style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>
                Total Messages
              </div>
            </Card>
            
            <Card style={{ 
              padding: '16px', 
              textAlign: 'center',
              background: 'var(--surface-glass)'
            }}>
              <div style={{ 
                fontSize: '24px', 
                fontWeight: '600', 
                color: 'var(--accent-primary)' 
              }}>
                {(metaAnalysis.summary.avgOverlap * 100).toFixed(1)}%
              </div>
              <div style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>
                Avg Overlap
              </div>
            </Card>
          </div>
        </div>
      )}
    </div>
  )
}